import OpenAI from 'openai';
import type { Stream } from 'openai/streaming';
import { AuthType } from '@office-ai/aioncli-core';
import type { RotatingApiClientOptions } from '../RotatingApiClient';
import { RotatingApiClient } from '../RotatingApiClient';

/**
 * Streaming event types for OpenAI API responses
 */
export type OpenAIStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'reasoning_delta'; reasoning: string } // For o1/o3 models
  | { type: 'tool_call_delta'; id: string; name?: string; arguments?: string }
  | { type: 'tool_call_complete'; id: string; name: string; arguments: string }
  | { type: 'usage'; promptTokens: number; completionTokens: number; totalTokens: number }
  | { type: 'finish'; finishReason: string }
  | { type: 'error'; message: string };

/**
 * Callbacks for streaming events
 */
export interface OpenAIStreamCallbacks {
  onTextDelta?: (text: string) => void;
  onReasoningDelta?: (reasoning: string) => void;
  onToolCallDelta?: (toolCall: { id: string; name?: string; arguments?: string }) => void;
  onToolCallComplete?: (toolCall: { id: string; name: string; arguments: string }) => void;
  onTokenCount?: (tokens: { promptTokens: number; completionTokens: number; totalTokens: number }) => void;
  onError?: (error: Error) => void;
}

export interface OpenAIClientConfig {
  baseURL?: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
  httpAgent?: unknown;
}

export class OpenAIRotatingClient extends RotatingApiClient<OpenAI> {
  private readonly baseConfig: OpenAIClientConfig;

  constructor(apiKeys: string, config: OpenAIClientConfig = {}, options: RotatingApiClientOptions = {}) {
    const createClient = (apiKey: string) => {
      const cleanedApiKey = apiKey.replace(/[\s\r\n\t]/g, '').trim();
      const openaiConfig: any = {
        baseURL: config.baseURL,
        apiKey: cleanedApiKey,
        defaultHeaders: config.defaultHeaders,
      };

      if (config.httpAgent) {
        openaiConfig.httpAgent = config.httpAgent;
      }

      return new OpenAI(openaiConfig);
    };

    super(apiKeys, AuthType.USE_OPENAI, createClient, options);
    this.baseConfig = config;
  }

  protected getCurrentApiKey(): string | undefined {
    if (this.apiKeyManager?.hasMultipleKeys()) {
      // For OpenAI, try to get from environment first
      return process.env.OPENAI_API_KEY || this.apiKeyManager.getCurrentKey();
    }
    // Use base class method for single key
    return super.getCurrentApiKey();
  }

  // Convenience methods for common OpenAI operations
  async createChatCompletion(params: OpenAI.Chat.Completions.ChatCompletionCreateParams, options?: OpenAI.RequestOptions): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    return await this.executeWithRetry((client) => {
      return client.chat.completions.create(params, options) as Promise<OpenAI.Chat.Completions.ChatCompletion>;
    });
  }

  async createImage(params: OpenAI.Images.ImageGenerateParams, options?: OpenAI.RequestOptions): Promise<OpenAI.Images.ImagesResponse> {
    return await this.executeWithRetry((client) => {
      return client.images.generate(params, options) as Promise<OpenAI.Images.ImagesResponse>;
    });
  }

  async createEmbedding(params: OpenAI.Embeddings.EmbeddingCreateParams, options?: OpenAI.RequestOptions): Promise<OpenAI.Embeddings.CreateEmbeddingResponse> {
    return await this.executeWithRetry((client) => {
      return client.embeddings.create(params, options);
    });
  }

  /**
   * Streaming chat completion - yields events as they arrive from OpenAI API
   * Supports text deltas, reasoning content (o1/o3 models), and tool calls
   */
  async *createChatCompletionStream(params: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParams, 'stream'>, callbacks?: OpenAIStreamCallbacks, options?: { signal?: AbortSignal }): AsyncGenerator<OpenAIStreamEvent, void, unknown> {
    if (options?.signal?.aborted) {
      throw new Error('Request was aborted');
    }

    if (!this.client) {
      throw new Error('Client not initialized - no valid API key provided');
    }

    // Track tool calls being accumulated
    const pendingToolCalls = new Map<number, { id: string; name: string; arguments: string }>();

    try {
      const streamParams: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        ...params,
        stream: true,
        stream_options: { include_usage: true },
      };

      const stream = (await this.client.chat.completions.create(streamParams as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming)) as Stream<OpenAI.Chat.Completions.ChatCompletionChunk>;

      for await (const chunk of stream) {
        // Check for abort signal
        if (options?.signal?.aborted) {
          break;
        }

        // Process the stream chunk
        yield* this.processOpenAIStreamChunk(chunk, callbacks, pendingToolCalls);
      }

      // Emit any remaining pending tool calls as complete
      for (const [, toolCall] of pendingToolCalls) {
        callbacks?.onToolCallComplete?.(toolCall);
        yield {
          type: 'tool_call_complete',
          id: toolCall.id,
          name: toolCall.name,
          arguments: toolCall.arguments,
        };
      }
    } catch (error) {
      const errorEvent: OpenAIStreamEvent = {
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
      callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
      yield errorEvent;
      throw error;
    }
  }

  /**
   * Process a single OpenAI stream chunk and yield appropriate events
   */
  private *processOpenAIStreamChunk(chunk: OpenAI.Chat.Completions.ChatCompletionChunk, callbacks?: OpenAIStreamCallbacks, pendingToolCalls?: Map<number, { id: string; name: string; arguments: string }>): Generator<OpenAIStreamEvent, void, unknown> {
    // Process usage information (sent at the end with stream_options.include_usage)
    if (chunk.usage) {
      const usage = {
        promptTokens: chunk.usage.prompt_tokens,
        completionTokens: chunk.usage.completion_tokens,
        totalTokens: chunk.usage.total_tokens,
      };
      callbacks?.onTokenCount?.(usage);
      yield { type: 'usage', ...usage };
    }

    // Process choices
    if (chunk.choices && chunk.choices.length > 0) {
      const choice = chunk.choices[0];
      const delta = choice.delta;

      // Handle text content
      if (delta?.content) {
        callbacks?.onTextDelta?.(delta.content);
        yield { type: 'text_delta', text: delta.content };
      }

      // Handle reasoning content (for o1/o3 models)
      // The OpenAI API uses 'reasoning_content' field for chain-of-thought
      if (delta && 'reasoning_content' in delta && typeof delta.reasoning_content === 'string') {
        callbacks?.onReasoningDelta?.(delta.reasoning_content);
        yield { type: 'reasoning_delta', reasoning: delta.reasoning_content };
      }

      // Handle tool calls
      if (delta?.tool_calls) {
        for (const toolCallDelta of delta.tool_calls) {
          const index = toolCallDelta.index;

          // Initialize pending tool call if this is a new one
          if (toolCallDelta.id && pendingToolCalls) {
            pendingToolCalls.set(index, {
              id: toolCallDelta.id,
              name: toolCallDelta.function?.name || '',
              arguments: '',
            });
          }

          // Accumulate function arguments
          if (toolCallDelta.function?.arguments && pendingToolCalls) {
            const pending = pendingToolCalls.get(index);
            if (pending) {
              pending.arguments += toolCallDelta.function.arguments;
              if (toolCallDelta.function.name) {
                pending.name = toolCallDelta.function.name;
              }
            }
          }

          // Emit tool call delta
          callbacks?.onToolCallDelta?.({
            id: toolCallDelta.id || pendingToolCalls?.get(index)?.id || '',
            name: toolCallDelta.function?.name,
            arguments: toolCallDelta.function?.arguments,
          });
          yield {
            type: 'tool_call_delta',
            id: toolCallDelta.id || pendingToolCalls?.get(index)?.id || '',
            name: toolCallDelta.function?.name,
            arguments: toolCallDelta.function?.arguments,
          };
        }
      }

      // Handle finish reason
      if (choice.finish_reason) {
        yield { type: 'finish', finishReason: choice.finish_reason };
      }
    }
  }
}
