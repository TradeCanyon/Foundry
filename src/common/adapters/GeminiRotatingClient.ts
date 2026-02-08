import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { AuthType } from '@office-ai/aioncli-core';
import type { RotatingApiClientOptions } from '../RotatingApiClient';
import { RotatingApiClient } from '../RotatingApiClient';
import { OpenAI2GeminiConverter, type OpenAIChatCompletionParams, type OpenAIChatCompletionResponse } from './OpenAI2GeminiConverter';

/**
 * Streaming event types for Gemini API responses
 */
export type GeminiStreamEvent = { type: 'text_delta'; text: string } | { type: 'thought_delta'; thought: string } | { type: 'tool_call'; name: string; args: Record<string, unknown> } | { type: 'usage'; promptTokens: number; candidatesTokens: number; totalTokens: number } | { type: 'finish'; finishReason: string } | { type: 'error'; message: string };

/**
 * Callbacks for streaming events
 */
export interface GeminiStreamCallbacks {
  onTextDelta?: (text: string) => void;
  onThoughtDelta?: (thought: string) => void;
  onToolCall?: (tool: { name: string; args: Record<string, unknown> }) => void;
  onTokenCount?: (tokens: { promptTokens: number; candidatesTokens: number; totalTokens: number }) => void;
  onError?: (error: Error) => void;
}

export interface GeminiClientConfig {
  model?: string;
  baseURL?: string;
  requestOptions?: Record<string, unknown>;
}

export class GeminiRotatingClient extends RotatingApiClient<GoogleGenAI> {
  private readonly config: GeminiClientConfig;
  private readonly converter: OpenAI2GeminiConverter;

  constructor(apiKeys: string, config: GeminiClientConfig = {}, options: RotatingApiClientOptions = {}, authType: AuthType = AuthType.USE_GEMINI) {
    const createClient = (apiKey: string) => {
      const cleanedApiKey = apiKey.replace(/[\s\r\n\t]/g, '').trim();
      const clientConfig: {
        apiKey?: string;
        vertexai: boolean;
        baseURL?: string;
      } = {
        apiKey: cleanedApiKey === '' ? undefined : cleanedApiKey,
        vertexai: authType === AuthType.USE_VERTEX_AI,
      };
      if (config.baseURL) {
        clientConfig.baseURL = config.baseURL;
      }
      return new GoogleGenAI(clientConfig);
    };

    super(apiKeys, authType, createClient, options);
    this.config = config;
    this.converter = new OpenAI2GeminiConverter({
      defaultModel: config.model || 'gemini-2.5-flash',
    });
  }

  protected getCurrentApiKey(): string | undefined {
    if (this.apiKeyManager?.hasMultipleKeys()) {
      // For Gemini, try to get from environment first
      return process.env.GEMINI_API_KEY || this.apiKeyManager.getCurrentKey();
    }
    // Use base class method for single key
    return super.getCurrentApiKey();
  }

  // Remove async override since base class is now sync
  // protected async initializeClient(): Promise<void> {
  //   await super.initializeClient();
  // }

  // Basic method for Gemini operations - can be extended as needed
  async generateContent(prompt: string, config?: Record<string, unknown>): Promise<unknown> {
    return await this.executeWithRetry(async (client) => {
      // client is GoogleGenAI, we need client.models to get the content generator
      const model = await client.models.generateContent({
        model: this.config.model || 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...config,
      });
      return model;
    });
  }

  // OpenAI-compatible createChatCompletion method for unified interface
  async createChatCompletion(params: OpenAIChatCompletionParams, options?: { signal?: AbortSignal; timeout?: number }): Promise<OpenAIChatCompletionResponse> {
    // Handle request cancellation
    if (options?.signal?.aborted) {
      throw new Error('Request was aborted');
    }

    return await this.executeWithRetry(async (client) => {
      // Convert OpenAI format to Gemini format using converter
      const geminiRequest = this.converter.convertRequest(params);

      // Call Gemini API
      const geminiResponse = await client.models.generateContent(geminiRequest);

      // Convert Gemini response back to OpenAI format using converter
      return this.converter.convertResponse(geminiResponse, params.model);
    });
  }

  /**
   * Streaming chat completion - yields events as they arrive from Gemini API
   * Supports text deltas, tool calls, and usage information
   */
  async *createChatCompletionStream(params: OpenAIChatCompletionParams, callbacks?: GeminiStreamCallbacks, options?: { signal?: AbortSignal }): AsyncGenerator<GeminiStreamEvent, void, unknown> {
    if (options?.signal?.aborted) {
      throw new Error('Request was aborted');
    }

    if (!this.client) {
      throw new Error('Client not initialized - no valid API key provided');
    }

    // Convert OpenAI format to Gemini format
    const geminiRequest = this.converter.convertRequest(params);

    try {
      // Call streaming API
      const stream = await this.client.models.generateContentStream(geminiRequest);

      for await (const chunk of stream) {
        // Check for abort signal
        if (options?.signal?.aborted) {
          break;
        }

        // Process the response chunk
        yield* this.processStreamChunk(chunk, callbacks);
      }
    } catch (error) {
      const errorEvent: GeminiStreamEvent = {
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
      callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
      yield errorEvent;
      throw error;
    }
  }

  /**
   * Process a single stream chunk and yield appropriate events
   */
  private *processStreamChunk(chunk: GenerateContentResponse, callbacks?: GeminiStreamCallbacks): Generator<GeminiStreamEvent, void, unknown> {
    // Process candidates (the actual content)
    if (chunk.candidates && chunk.candidates.length > 0) {
      const candidate = chunk.candidates[0];

      // Process content parts
      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          // Text content
          if ('text' in part && part.text) {
            callbacks?.onTextDelta?.(part.text);
            yield { type: 'text_delta', text: part.text };
          }

          // Thought/reasoning content (if available)
          if ('thought' in part && typeof part.thought === 'string') {
            callbacks?.onThoughtDelta?.(part.thought);
            yield { type: 'thought_delta', thought: part.thought };
          }

          // Function calls
          if ('functionCall' in part && part.functionCall) {
            const toolCall = {
              name: part.functionCall.name || '',
              args: (part.functionCall.args as Record<string, unknown>) || {},
            };
            callbacks?.onToolCall?.(toolCall);
            yield { type: 'tool_call', name: toolCall.name, args: toolCall.args };
          }
        }
      }

      // Check for finish reason
      if (candidate.finishReason) {
        yield { type: 'finish', finishReason: candidate.finishReason };
      }
    }

    // Process usage metadata
    if (chunk.usageMetadata) {
      const usage = {
        promptTokens: chunk.usageMetadata.promptTokenCount || 0,
        candidatesTokens: chunk.usageMetadata.candidatesTokenCount || 0,
        totalTokens: chunk.usageMetadata.totalTokenCount || 0,
      };
      callbacks?.onTokenCount?.(usage);
      yield { type: 'usage', ...usage };
    }
  }

  /**
   * Direct streaming content generation with native Gemini types
   */
  async *generateContentStream(prompt: string, config?: Record<string, unknown>, callbacks?: GeminiStreamCallbacks, options?: { signal?: AbortSignal }): AsyncGenerator<GeminiStreamEvent, void, unknown> {
    if (options?.signal?.aborted) {
      throw new Error('Request was aborted');
    }

    if (!this.client) {
      throw new Error('Client not initialized - no valid API key provided');
    }

    try {
      const stream = await this.client.models.generateContentStream({
        model: this.config.model || 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...config,
      });

      for await (const chunk of stream) {
        if (options?.signal?.aborted) {
          break;
        }
        yield* this.processStreamChunk(chunk, callbacks);
      }
    } catch (error) {
      const errorEvent: GeminiStreamEvent = {
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
      callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
      yield errorEvent;
      throw error;
    }
  }
}
