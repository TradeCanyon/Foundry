/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TProviderWithModel } from '@/common/storage';
import type { GeminiClient } from '@office-ai/aioncli-core';
import { AuthType, Config } from '@office-ai/aioncli-core';
// import { ImageGenerationTool } from './img-gen'; // Disabled — image gen shelved
import { BrowserNavigateTool, BrowserScreenshotTool, BrowserExtractTool, BrowserClickTool, BrowserFillTool, BrowserWaitTool } from './browser';
import { WebFetchTool } from './web-fetch';
import { WebSearchTool } from './web-search';

interface ConversationToolConfigOptions {
  proxy: string;
  imageGenerationModel?: TProviderWithModel;
  geminiApiKey?: string;
  imageGenNativeModel?: string;
  webSearchEngine?: 'google' | 'default';
  useBrowserAgent?: boolean;
}

/**
 * Conversation-level tool configuration
 * Similar to workspace mechanism: determined at conversation creation, unchanged throughout the conversation
 */
export class ConversationToolConfig {
  private useGeminiWebSearch = false;
  private useFoundryWebFetch = false;
  private useBrowserAgent = false;
  private excludeTools: string[] = [];
  private imageGenerationModel: TProviderWithModel | undefined;
  private geminiApiKey: string | undefined;
  private imageGenNativeModel: string | undefined;
  private proxy: string = '';
  constructor(options: ConversationToolConfigOptions) {
    this.proxy = options.proxy;
    this.imageGenerationModel = options.imageGenerationModel;
    this.geminiApiKey = options.geminiApiKey;
    this.imageGenNativeModel = options.imageGenNativeModel;
    this.useBrowserAgent = options.useBrowserAgent ?? true;
  }

  /**
   * Decide tool configuration at conversation creation (similar to workspace determination mechanism)
   * @param authType Authentication type (platform type)
   */
  async initializeForConversation(_authType: AuthType): Promise<void> {
    // All models use foundry_web_fetch to replace built-in web_fetch
    this.useFoundryWebFetch = true;
    this.excludeTools.push('web_fetch');

    // All models use our custom web search (no confirmation required, multi-fallback).
    // The built-in google_web_search requires confirmation + grounding API setup that
    // is unreliable. Our custom tool uses Jina Reader with DDG direct fallback.
    this.useGeminiWebSearch = true;
    this.excludeTools.push('google_web_search');
  }

  /**
   * Get tool configuration for current conversation
   */
  getConfig() {
    return {
      useGeminiWebSearch: this.useGeminiWebSearch,
      useFoundryWebFetch: this.useFoundryWebFetch,
      useBrowserAgent: this.useBrowserAgent,
      excludeTools: this.excludeTools,
    };
  }

  /**
   * Register custom tools for the given Config
   * Called after conversation initialization
   */
  async registerCustomTools(config: Config, geminiClient: GeminiClient): Promise<void> {
    const toolRegistry = await config.getToolRegistry();

    // Register foundry_web_fetch tool (all models)
    if (this.useFoundryWebFetch) {
      const customWebFetchTool = new WebFetchTool(geminiClient, config.getMessageBus());
      toolRegistry.registerTool(customWebFetchTool);
    }

    // Image generation tool disabled — CLIs don't natively support image gen
    // and third-party APIs are unreliable. Gemini will gracefully decline image requests.

    // Register gemini_web_search tool (non-Gemini models only, uses Jina Reader fallback)
    if (this.useGeminiWebSearch) {
      const customWebSearchTool = new WebSearchTool(geminiClient, config.getMessageBus());
      toolRegistry.registerTool(customWebSearchTool);
    }

    // Register browser agent tools (6 tools for persistent browser control)
    if (this.useBrowserAgent) {
      const conversationId = config.getSessionId()?.split('########')[0] || 'default';
      const bus = config.getMessageBus();
      toolRegistry.registerTool(new BrowserNavigateTool(bus, conversationId));
      toolRegistry.registerTool(new BrowserScreenshotTool(bus, conversationId));
      toolRegistry.registerTool(new BrowserExtractTool(bus, conversationId));
      toolRegistry.registerTool(new BrowserClickTool(bus, conversationId));
      toolRegistry.registerTool(new BrowserFillTool(bus, conversationId));
      toolRegistry.registerTool(new BrowserWaitTool(bus, conversationId));
    }

    // Sync tools to model client
    await geminiClient.setTools();
  }
}
