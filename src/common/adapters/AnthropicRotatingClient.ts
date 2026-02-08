/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import Anthropic, { type ClientOptions as AnthropicClientOptions_ } from '@anthropic-ai/sdk';
import type { RawMessageStreamEvent, RawContentBlockDeltaEvent, RawContentBlockStartEvent, MessageCreateParamsStreaming, Message } from '@anthropic-ai/sdk/resources/messages';
import { AuthType } from '@office-ai/aioncli-core';
import type { RotatingApiClientOptions } from '../RotatingApiClient';
import { RotatingApiClient } from '../RotatingApiClient';
import { OpenAI2AnthropicConverter, type OpenAIChatCompletionParams, type OpenAIChatCompletionResponse } from './OpenAI2AnthropicConverter';

/**
 * Streaming event types for Claude API responses
 */
export type AnthropicStreamEvent = { type: 'text_delta'; text: string } | { type: 'thinking_delta'; thinking: string } | { type: 'tool_use_start'; id: string; name: string } | { type: 'tool_use_delta'; id: string; input: string } | { type: 'message_start'; message: Message } | { type: 'message_delta'; usage?: { output_tokens: number } } | { type: 'message_stop' } | { type: 'content_block_start'; index: number; blockType: string } | { type: 'content_block_stop'; index: number };

/**
 * Callbacks for streaming events
 */
export interface AnthropicStreamCallbacks {
  onTextDelta?: (text: string) => void;
  onThinkingDelta?: (thinking: string) => void;
  onToolUse?: (tool: { name: string; id: string }) => void;
  onTokenCount?: (tokens: { output_tokens: number }) => void;
  onError?: (error: Error) => void;
}

export interface AnthropicClientConfig {
  model?: string;
  baseURL?: string;
  timeout?: number;
}

export class AnthropicRotatingClient extends RotatingApiClient<Anthropic> {
  private readonly config: AnthropicClientConfig;
  private readonly converter: OpenAI2AnthropicConverter;

  constructor(apiKeys: string, config: AnthropicClientConfig = {}, options: RotatingApiClientOptions = {}) {
    const createClient = (apiKey: string) => {
      const cleanedApiKey = apiKey.replace(/[\s\r\n\t]/g, '').trim();

      const clientConfig: AnthropicClientOptions_ = {
        apiKey: cleanedApiKey,
      };

      if (config.baseURL) {
        clientConfig.baseURL = config.baseURL;
      }

      if (config.timeout) {
        clientConfig.timeout = config.timeout;
      }

      return new Anthropic(clientConfig);
    };

    super(apiKeys, AuthType.USE_ANTHROPIC, createClient, options);
    this.config = config;
    this.converter = new OpenAI2AnthropicConverter({
      defaultModel: config.model || 'claude-sonnet-4-5-20250929',
    });
  }

  protected getCurrentApiKey(): string | undefined {
    if (this.apiKeyManager?.hasMultipleKeys()) {
      // For Anthropic, try to get from environment first
      return process.env.ANTHROPIC_API_KEY || this.apiKeyManager.getCurrentKey();
    }
    // Use base class method for single key
    return super.getCurrentApiKey();
  }

  /**
   * OpenAI-compatible createChatCompletion method for unified interface
   */
  async createChatCompletion(params: OpenAIChatCompletionParams, options?: { signal?: AbortSignal; timeout?: number }): Promise<OpenAIChatCompletionResponse> {
    // Handle request cancellation
    if (options?.signal?.aborted) {
      throw new Error('Request was aborted');
    }

    return await this.executeWithRetry(async (client) => {
      // Convert OpenAI format to Anthropic format using converter
      const anthropicRequest = this.converter.convertRequest(params);

      // Call Anthropic API
      const anthropicResponse = await client.messages.create(anthropicRequest);

      // Convert Anthropic response back to OpenAI format using converter
      return this.converter.convertResponse(anthropicResponse, params.model);
    });
  }

  /**
   * Direct Anthropic API call for native usage
   */
  async createMessage(request: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
    return await this.executeWithRetry(async (client) => {
      return await client.messages.create(request);
    });
  }

  /**
   * Streaming chat completion - yields events as they arrive from Claude API
   * Supports text deltas, extended thinking deltas, and tool use events
   */
  async *createChatCompletionStream(params: OpenAIChatCompletionParams, callbacks?: AnthropicStreamCallbacks, options?: { signal?: AbortSignal }): AsyncGenerator<AnthropicStreamEvent, void, unknown> {
    if (options?.signal?.aborted) {
      throw new Error('Request was aborted');
    }

    if (!this.client) {
      throw new Error('Client not initialized - no valid API key provided');
    }

    // Convert OpenAI format to Anthropic format
    const anthropicRequest = this.converter.convertRequest(params);

    // Create streaming request
    const streamingRequest: MessageCreateParamsStreaming = {
      ...anthropicRequest,
      stream: true,
    };

    const stream = await this.client.messages.create(streamingRequest);

    // Track current tool use for accumulating input JSON
    let currentToolUse: { id: string; name: string; inputJson: string } | null = null;

    try {
      for await (const event of stream as AsyncIterable<RawMessageStreamEvent>) {
        // Check for abort signal
        if (options?.signal?.aborted) {
          break;
        }

        switch (event.type) {
          case 'message_start':
            yield {
              type: 'message_start',
              message: event.message,
            };
            break;

          case 'message_delta':
            if (event.usage) {
              callbacks?.onTokenCount?.({ output_tokens: event.usage.output_tokens });
              yield {
                type: 'message_delta',
                usage: { output_tokens: event.usage.output_tokens },
              };
            }
            break;

          case 'message_stop':
            yield { type: 'message_stop' };
            break;

          case 'content_block_start': {
            const startEvent = event as RawContentBlockStartEvent;
            const blockType = startEvent.content_block.type;

            yield {
              type: 'content_block_start',
              index: startEvent.index,
              blockType,
            };

            // Handle tool use start
            if (blockType === 'tool_use') {
              const toolBlock = startEvent.content_block as { id: string; name: string };
              currentToolUse = {
                id: toolBlock.id,
                name: toolBlock.name,
                inputJson: '',
              };
              callbacks?.onToolUse?.({ name: toolBlock.name, id: toolBlock.id });
              yield {
                type: 'tool_use_start',
                id: toolBlock.id,
                name: toolBlock.name,
              };
            }
            break;
          }

          case 'content_block_delta': {
            const deltaEvent = event as RawContentBlockDeltaEvent;
            const delta = deltaEvent.delta;

            if (delta.type === 'text_delta') {
              callbacks?.onTextDelta?.(delta.text);
              yield { type: 'text_delta', text: delta.text };
            } else if (delta.type === 'thinking_delta') {
              callbacks?.onThinkingDelta?.(delta.thinking);
              yield { type: 'thinking_delta', thinking: delta.thinking };
            } else if (delta.type === 'input_json_delta' && currentToolUse) {
              // Accumulate tool input JSON
              const jsonDelta = delta as { partial_json: string };
              currentToolUse.inputJson += jsonDelta.partial_json;
              yield {
                type: 'tool_use_delta',
                id: currentToolUse.id,
                input: jsonDelta.partial_json,
              };
            }
            break;
          }

          case 'content_block_stop':
            currentToolUse = null;
            yield {
              type: 'content_block_stop',
              index: event.index,
            };
            break;
        }
      }
    } catch (error) {
      callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Streaming message creation with native Anthropic types
   * Provides raw access to the streaming API with callbacks
   */
  async *createMessageStream(request: Omit<Anthropic.MessageCreateParamsNonStreaming, 'stream'>, callbacks?: AnthropicStreamCallbacks, options?: { signal?: AbortSignal }): AsyncGenerator<AnthropicStreamEvent, void, unknown> {
    if (options?.signal?.aborted) {
      throw new Error('Request was aborted');
    }

    if (!this.client) {
      throw new Error('Client not initialized - no valid API key provided');
    }

    const streamingRequest: MessageCreateParamsStreaming = {
      ...request,
      stream: true,
    };

    const stream = await this.client.messages.create(streamingRequest);

    let currentToolUse: { id: string; name: string; inputJson: string } | null = null;

    try {
      for await (const event of stream as AsyncIterable<RawMessageStreamEvent>) {
        if (options?.signal?.aborted) {
          break;
        }

        switch (event.type) {
          case 'message_start':
            yield { type: 'message_start', message: event.message };
            break;

          case 'message_delta':
            if (event.usage) {
              callbacks?.onTokenCount?.({ output_tokens: event.usage.output_tokens });
              yield { type: 'message_delta', usage: { output_tokens: event.usage.output_tokens } };
            }
            break;

          case 'message_stop':
            yield { type: 'message_stop' };
            break;

          case 'content_block_start': {
            const startEvent = event as RawContentBlockStartEvent;
            const blockType = startEvent.content_block.type;
            yield { type: 'content_block_start', index: startEvent.index, blockType };

            if (blockType === 'tool_use') {
              const toolBlock = startEvent.content_block as { id: string; name: string };
              currentToolUse = { id: toolBlock.id, name: toolBlock.name, inputJson: '' };
              callbacks?.onToolUse?.({ name: toolBlock.name, id: toolBlock.id });
              yield { type: 'tool_use_start', id: toolBlock.id, name: toolBlock.name };
            }
            break;
          }

          case 'content_block_delta': {
            const deltaEvent = event as RawContentBlockDeltaEvent;
            const delta = deltaEvent.delta;

            if (delta.type === 'text_delta') {
              callbacks?.onTextDelta?.(delta.text);
              yield { type: 'text_delta', text: delta.text };
            } else if (delta.type === 'thinking_delta') {
              callbacks?.onThinkingDelta?.(delta.thinking);
              yield { type: 'thinking_delta', thinking: delta.thinking };
            } else if (delta.type === 'input_json_delta' && currentToolUse) {
              const jsonDelta = delta as { partial_json: string };
              currentToolUse.inputJson += jsonDelta.partial_json;
              yield { type: 'tool_use_delta', id: currentToolUse.id, input: jsonDelta.partial_json };
            }
            break;
          }

          case 'content_block_stop':
            currentToolUse = null;
            yield { type: 'content_block_stop', index: event.index };
            break;
        }
      }
    } catch (error) {
      callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
