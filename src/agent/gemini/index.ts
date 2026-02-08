/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

// Re-export GeminiApprovalStore for use in other modules
export { GeminiApprovalStore } from './GeminiApprovalStore';

// src/core/ConfigManager.ts
import { FOUNDRY_FILES_MARKER } from '@/common/constants';
import { NavigationInterceptor } from '@/common/navigation';
import type { TProviderWithModel } from '@/common/storage';
import { uuid } from '@/common/utils';
import { getProviderAuthType } from '@/common/utils/platformAuthType';
import type { CompletedToolCall, Config, GeminiClient, ServerGeminiStreamEvent, ToolCall, ToolCallRequestInfo, Turn } from '@office-ai/aioncli-core';
import { AuthType, CoreToolScheduler, FileDiscoveryService, sessionId, refreshServerHierarchicalMemory, clearOauthClientCache } from '@office-ai/aioncli-core';
import { ApiKeyManager } from '../../common/ApiKeyManager';
import { handleAtCommand } from './cli/atCommandProcessor';
import { loadCliConfig } from './cli/config';
import { loadExtensions } from './cli/extension';
import type { Settings } from './cli/settings';
import { loadSettings } from './cli/settings';
import { ConversationToolConfig } from './cli/tools/conversation-tool-config';
import { mapToDisplay, type TrackedToolCall } from './cli/useReactToolScheduler';
import { getPromptCount, handleCompletedTools, processGeminiStreamEvents, startNewPrompt } from './utils';
import { globalToolCallGuard, type StreamConnectionEvent } from './cli/streamResilience';
import { getGlobalTokenManager } from './cli/oauthTokenManager';
import fs from 'fs';
import path from 'path';

// Global registry for current agent instance (used by flashFallbackHandler)
let currentGeminiAgent: GeminiAgent | null = null;

interface GeminiAgent2Options {
  workspace: string;
  proxy?: string;
  model: TProviderWithModel;
  imageGenerationModel?: TProviderWithModel;
  geminiApiKey?: string;
  imageGenNativeModel?: string;
  webSearchEngine?: 'google' | 'default';
  yoloMode?: boolean;
  GOOGLE_CLOUD_PROJECT?: string;
  mcpServers?: Record<string, unknown>;
  contextFileName?: string;
  onStreamEvent: (event: { type: string; data: unknown; msg_id: string }) => void;
  // System rules, injected into userMemory at initialization
  presetRules?: string;
  contextContent?: string; // Backward compatible
  /** Builtin skills directory path, loaded by aioncli-core SkillManager */
  skillsDir?: string;
  /** Enabled skills list for filtering skills in SkillManager */
  enabledSkills?: string[];
}

export class GeminiAgent {
  config: Config | null = null;
  private workspace: string | null = null;
  private proxy: string | null = null;
  private model: TProviderWithModel | null = null;
  private imageGenerationModel: TProviderWithModel | null = null;
  private geminiApiKey: string | null = null;
  private imageGenNativeModel: string | null = null;
  private webSearchEngine: 'google' | 'default' | null = null;
  private yoloMode: boolean = false;
  private googleCloudProject: string | null = null;
  private mcpServers: Record<string, unknown> = {};
  private geminiClient: GeminiClient | null = null;
  private authType: AuthType | null = null;
  private scheduler: CoreToolScheduler | null = null;
  private trackedCalls: TrackedToolCall[] = [];
  private abortController: AbortController | null = null;
  private activeMsgId: string | null = null;
  private onStreamEvent: (event: { type: string; data: unknown; msg_id: string }) => void;
  // System rules, injected at initialization
  private presetRules?: string;
  private contextContent?: string; // Backward compatible
  private toolConfig: ConversationToolConfig; // Conversation-level tool config
  private apiKeyManager: ApiKeyManager | null = null; // Multi API Key manager
  private settings: Settings | null = null;
  private historyPrefix: string | null = null;
  private historyUsedOnce = false;
  private skillsIndexPrependedOnce = false; // Track if we've prepended skills index to first message
  private contextFileName: string | undefined;
  /** Builtin skills directory path */
  private skillsDir?: string;
  /** Enabled skills list */
  private enabledSkills?: string[];
  bootstrap: Promise<void>;
  static buildFileServer(workspace: string) {
    return new FileDiscoveryService(workspace);
  }
  constructor(options: GeminiAgent2Options) {
    this.workspace = options.workspace;
    this.proxy = options.proxy;
    this.model = options.model;
    this.imageGenerationModel = options.imageGenerationModel;
    this.geminiApiKey = options.geminiApiKey;
    this.imageGenNativeModel = options.imageGenNativeModel || null;
    this.webSearchEngine = options.webSearchEngine || 'default';
    this.yoloMode = options.yoloMode || false;
    this.googleCloudProject = options.GOOGLE_CLOUD_PROJECT;
    this.mcpServers = options.mcpServers || {};
    this.contextFileName = options.contextFileName;
    // Use unified utility function to get auth type
    this.authType = getProviderAuthType(options.model);
    this.onStreamEvent = options.onStreamEvent;
    this.presetRules = options.presetRules;
    this.skillsDir = options.skillsDir;
    this.enabledSkills = options.enabledSkills;
    // Backward compatible: prefer presetRules, fallback to contextContent
    this.contextContent = options.contextContent || options.presetRules;
    this.initClientEnv();
    this.toolConfig = new ConversationToolConfig({
      proxy: this.proxy,
      imageGenerationModel: this.imageGenerationModel,
      geminiApiKey: this.geminiApiKey,
      imageGenNativeModel: this.imageGenNativeModel,
      webSearchEngine: this.webSearchEngine,
    });

    // Register as current agent for flashFallbackHandler access
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    currentGeminiAgent = this;

    this.bootstrap = this.initialize();
  }

  private initClientEnv() {
    const fallbackValue = (key: string, value1: string, value2?: string) => {
      if (value1 && value1 !== 'undefined') {
        process.env[key] = value1;
      }
      if (value2 && value2 !== 'undefined') {
        process.env[key] = value2;
      }
    };

    // Initialize multi-key manager for supported auth types
    this.initializeMultiKeySupport();

    // Get the current API key to use (either from multi-key manager or original)
    const getCurrentApiKey = () => {
      if (this.apiKeyManager && this.apiKeyManager.hasMultipleKeys()) {
        return process.env[this.apiKeyManager.getStatus().envKey] || this.model.apiKey;
      }
      return this.model.apiKey;
    };

    // Clear all auth-related env vars to avoid interference between different auth types
    const clearAllAuthEnvVars = () => {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_GEMINI_BASE_URL;
      delete process.env.GOOGLE_API_KEY;
      delete process.env.GOOGLE_GENAI_USE_VERTEXAI;
      delete process.env.GOOGLE_CLOUD_PROJECT;
      delete process.env.OPENAI_BASE_URL;
      delete process.env.OPENAI_API_KEY;
    };

    clearAllAuthEnvVars();

    if (this.authType === AuthType.USE_GEMINI) {
      fallbackValue('GEMINI_API_KEY', getCurrentApiKey());
      fallbackValue('GOOGLE_GEMINI_BASE_URL', this.model.baseUrl);
      return;
    }
    if (this.authType === AuthType.USE_VERTEX_AI) {
      fallbackValue('GOOGLE_API_KEY', getCurrentApiKey());
      process.env.GOOGLE_GENAI_USE_VERTEXAI = 'true';
      return;
    }
    if (this.authType === AuthType.LOGIN_WITH_GOOGLE) {
      // For personal OAuth auth, GOOGLE_CLOUD_PROJECT is not needed
      // Invalid project ID will cause 403 permission error
      // Only set if user explicitly configured a valid project ID
      if (this.googleCloudProject && this.googleCloudProject.trim()) {
        process.env.GOOGLE_CLOUD_PROJECT = this.googleCloudProject.trim();
      }
      // Note: LOGIN_WITH_GOOGLE uses OAuth, no API Key needed
      return;
    }
    if (this.authType === AuthType.USE_OPENAI) {
      fallbackValue('OPENAI_BASE_URL', this.model.baseUrl);
      fallbackValue('OPENAI_API_KEY', getCurrentApiKey());
      return;
    }
    if (this.authType === AuthType.USE_ANTHROPIC) {
      fallbackValue('ANTHROPIC_BASE_URL', this.model.baseUrl);
      fallbackValue('ANTHROPIC_API_KEY', getCurrentApiKey());
    }
  }

  private initializeMultiKeySupport(): void {
    const apiKey = this.model?.apiKey;
    if (!apiKey || (!apiKey.includes(',') && !apiKey.includes('\n'))) {
      return; // Single key or no key, skip multi-key setup
    }

    // Only initialize for supported auth types
    if (this.authType === AuthType.USE_OPENAI || this.authType === AuthType.USE_GEMINI || this.authType === AuthType.USE_ANTHROPIC) {
      this.apiKeyManager = new ApiKeyManager(apiKey, this.authType);
    }
  }

  /**
   * Get multi-key manager (used by flashFallbackHandler)
   */
  getApiKeyManager(): ApiKeyManager | null {
    return this.apiKeyManager;
  }

  private createAbortController() {
    this.abortController = new AbortController();
    return this.abortController;
  }

  private enrichErrorMessage(errorMessage: string): string {
    const reportMatch = errorMessage.match(/Full report available at:\s*(.+?\.json)/i);
    const lowerMessage = errorMessage.toLowerCase();
    if (lowerMessage.includes('model_capacity_exhausted') || lowerMessage.includes('no capacity available') || lowerMessage.includes('resource_exhausted') || lowerMessage.includes('ratelimitexceeded')) {
      return `${errorMessage}\nQuota exhausted on this model.`;
    }
    if (!reportMatch?.[1]) return errorMessage;
    try {
      const reportContent = fs.readFileSync(reportMatch[1], 'utf-8');
      const reportLower = reportContent.toLowerCase();
      if (reportLower.includes('quota') || reportLower.includes('resource_exhausted') || reportLower.includes('exhausted')) {
        return `${errorMessage}\nQuota exhausted on this model.`;
      }
    } catch {
      // Ignore report read errors and keep original message.
    }
    return errorMessage;
  }

  /**
   * Check if a file path is an image file
   */
  private isImageFile(filePath: string): boolean {
    const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
    const ext = path.extname(filePath).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
  }

  /**
   * Filter out image files from file list (images should be sent via vision API, not as file references)
   */
  filterNonImageFiles(files?: string[]): string[] {
    if (!files) return [];
    return files.filter((f) => !this.isImageFile(f));
  }

  /**
   * Process image files for vision API multimodal support
   * Converts image files to base64 inline data parts for the Gemini vision API
   * Includes size limits to prevent context window overflow
   *
   * @param files - Array of file paths to process
   * @returns Array of inline data parts for images
   */
  private async processImageFilesForVision(files?: string[]): Promise<Array<{ inlineData: { mimeType: string; data: string } }>> {
    if (!files || files.length === 0) {
      return [];
    }

    // Max image size: 4MB (Gemini's limit for inline images)
    // Larger images would blow up the context window
    const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;

    const MIME_TYPE_MAP: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
    };

    const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];

    for (const filePath of files) {
      try {
        if (!this.isImageFile(filePath)) {
          // Skip non-image files
          continue;
        }

        // Check file size before reading
        const stats = await fs.promises.stat(filePath);
        if (stats.size > MAX_IMAGE_SIZE_BYTES) {
          console.warn(`[GeminiAgent] Image too large (${(stats.size / 1024 / 1024).toFixed(2)}MB), max ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB: ${filePath}`);
          // Emit warning to user
          this.onStreamEvent({
            type: 'warning',
            data: `Image "${path.basename(filePath)}" is too large (${(stats.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 4MB. Please use a smaller image.`,
            msg_id: '',
          });
          continue;
        }

        const ext = path.extname(filePath).toLowerCase();
        const buffer = await fs.promises.readFile(filePath);
        const base64Data = buffer.toString('base64');
        const mimeType = MIME_TYPE_MAP[ext] || 'image/png';

        imageParts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });

        console.log(`[GeminiAgent] Processed image for vision API: ${filePath} (${mimeType}, ${(stats.size / 1024).toFixed(1)}KB)`);
      } catch (error) {
        console.warn(`[GeminiAgent] Failed to process image file: ${filePath}`, error);
        // Continue processing other files even if one fails
      }
    }

    return imageParts;
  }

  private async initialize(): Promise<void> {
    const path = this.workspace;

    const settings = loadSettings(path).merged;
    if (this.contextFileName) {
      settings.contextFileName = this.contextFileName;
    }
    this.settings = settings;

    // Use the YOLO setting from options
    const yoloMode = this.yoloMode;

    // Initialize conversation-level tool config
    await this.toolConfig.initializeForConversation(this.authType!);

    const extensions = loadExtensions(path);
    this.config = await loadCliConfig({
      workspace: path,
      settings,
      extensions,
      sessionId,
      proxy: this.proxy,
      model: this.model.useModel,
      conversationToolConfig: this.toolConfig,
      yoloMode,
      mcpServers: this.mcpServers,
      skillsDir: this.skillsDir,
      enabledSkills: this.enabledSkills,
    });
    await this.config.initialize();

    // aioncli-core's SkillManager.discoverSkills() reloads all skills from user directory,
    // overriding our filtering in loadCliConfig, so we need to re-apply enabledSkills filter here
    if (this.enabledSkills && this.enabledSkills.length > 0) {
      const enabledSet = new Set(this.enabledSkills);
      this.config.getSkillManager().filterSkills((skill) => enabledSet.has(skill.name));
      console.log(`[GeminiAgent] Filtered skills after initialize: ${this.enabledSkills.join(', ')}`);
    }

    // For Google OAuth auth, clear cached OAuth client to ensure fresh credentials
    if (this.authType === AuthType.LOGIN_WITH_GOOGLE) {
      clearOauthClientCache();
    }

    await this.config.refreshAuth(this.authType || AuthType.USE_GEMINI);

    this.geminiClient = this.config.getGeminiClient();

    // Inject presetRules into userMemory at initialization
    // Rules define system behavior, should be effective from session start
    console.log(`[GeminiAgent] presetRules length: ${this.presetRules?.length || 0}`);
    if (this.presetRules) {
      const currentMemory = this.config.getUserMemory();
      const rulesSection = `[Assistant System Rules]\n${this.presetRules}`;
      const combined = currentMemory ? `${rulesSection}\n\n${currentMemory}` : rulesSection;
      this.config.setUserMemory(combined);
      console.log(`[GeminiAgent] Injected presetRules into userMemory, total length: ${combined.length}`);
    } else {
      console.log(`[GeminiAgent] No presetRules to inject`);
    }

    // Note: Skills are prepended to the first message in send() method
    // Skills provide capabilities/tools descriptions, injected at runtime

    // Register conversation-level custom tools
    await this.toolConfig.registerCustomTools(this.config, this.geminiClient);

    this.initToolScheduler(settings);
  }

  // Initialize tool scheduler
  private initToolScheduler(_settings: Settings) {
    this.scheduler = new CoreToolScheduler({
      onAllToolCallsComplete: async (completedToolCalls: CompletedToolCall[]) => {
        await Promise.resolve(); // Satisfy async requirement
        try {
          if (completedToolCalls.length > 0) {
            const refreshMemory = async () => {
              // Directly use refreshServerHierarchicalMemory from aioncli-core
              // It automatically gets ExtensionLoader from config and updates memory
              await refreshServerHierarchicalMemory(this.config);
            };
            const response = handleCompletedTools(completedToolCalls, this.geminiClient, refreshMemory);
            if (response.length > 0) {
              const geminiTools = completedToolCalls.filter((tc) => {
                const isTerminalState = tc.status === 'success' || tc.status === 'error' || tc.status === 'cancelled';

                if (isTerminalState) {
                  const completedOrCancelledCall = tc;
                  return completedOrCancelledCall.response?.responseParts !== undefined && !tc.request.isClientInitiated;
                }
                return false;
              });

              this.submitQuery(response, this.activeMsgId ?? uuid(), this.createAbortController(), {
                isContinuation: true,
                prompt_id: geminiTools[0].request.prompt_id,
              });
            }
          }
        } catch (e) {
          this.onStreamEvent({
            type: 'error',
            data: 'handleCompletedTools error: ' + (e.message || JSON.stringify(e)),
            msg_id: this.activeMsgId ?? uuid(),
          });
        }
      },
      onToolCallsUpdate: (updatedCoreToolCalls: ToolCall[]) => {
        try {
          const prevTrackedCalls = this.trackedCalls || [];
          const toolCalls: TrackedToolCall[] = updatedCoreToolCalls.map((coreTc) => {
            const existingTrackedCall = prevTrackedCalls.find((ptc) => ptc.request.callId === coreTc.request.callId);
            const newTrackedCall: TrackedToolCall = {
              ...coreTc,
              responseSubmittedToGemini: existingTrackedCall?.responseSubmittedToGemini ?? false,
            };
            return newTrackedCall;
          });
          const display = mapToDisplay(toolCalls);
          this.onStreamEvent({
            type: 'tool_group',
            data: display.tools,
            msg_id: this.activeMsgId ?? uuid(),
          });
        } catch (e) {
          this.onStreamEvent({
            type: 'error',
            data: 'tool_calls_update error: ' + (e.message || JSON.stringify(e)),
            msg_id: this.activeMsgId ?? uuid(),
          });
        }
      },
      // onEditorClose callback was removed in aioncli-core v0.18.4
      // approvalMode: this.config.getApprovalMode(),
      getPreferredEditor() {
        return 'vscode';
      },
      config: this.config,
    });
  }

  /**
   * Handle message stream with resilience monitoring and automatic retry
   *
   * @param query - Original query (for retry)
   * @param stream - Message stream
   * @param msg_id - Message ID
   * @param abortController - Abort controller
   * @param retryCount - Current retry count
   */
  private handleMessage(stream: AsyncGenerator<ServerGeminiStreamEvent, Turn, unknown>, msg_id: string, abortController: AbortController, query?: unknown, retryCount: number = 0): Promise<void> {
    const MAX_INVALID_STREAM_RETRIES = 2; // Max 2 retries
    const RETRY_DELAY_MS = 1000; // 1 second retry delay

    const toolCallRequests: ToolCallRequestInfo[] = [];
    let heartbeatWarned = false;
    let invalidStreamDetected = false;

    // Stream connection event handler
    const onConnectionEvent = (event: StreamConnectionEvent) => {
      if (event.type === 'heartbeat_timeout') {
        console.warn(`[GeminiAgent] Stream heartbeat timeout at ${new Date(event.lastEventTime).toISOString()}`);
        if (!heartbeatWarned) {
          heartbeatWarned = true;
        }
      } else if (event.type === 'state_change' && event.state === 'failed') {
        console.error(`[GeminiAgent] Stream connection failed: ${event.reason}`);
        this.onStreamEvent({
          type: 'error',
          data: `Connection lost: ${event.reason}. Please try again.`,
          msg_id,
        });
      }
    };

    return processGeminiStreamEvents(
      stream,
      this.config,
      (data) => {
        if (data.type === 'tool_call_request') {
          const toolRequest = data.data as ToolCallRequestInfo;
          toolCallRequests.push(toolRequest);
          // Immediately protect tool call to prevent cancellation
          globalToolCallGuard.protect(toolRequest.callId);
          return;
        }

        // Detect invalid_stream event
        if (data.type === ('invalid_stream' as string)) {
          invalidStreamDetected = true;
          const eventData = data.data as { message: string; retryable: boolean };
          if (eventData.retryable && retryCount < MAX_INVALID_STREAM_RETRIES && query && !abortController.signal.aborted) {
            console.warn(`[GeminiAgent] Invalid stream detected, will retry (attempt ${retryCount + 1}/${MAX_INVALID_STREAM_RETRIES})`);
            // Show retry hint to user
            this.onStreamEvent({
              type: 'info',
              data: `Stream interrupted, retrying... (${retryCount + 1}/${MAX_INVALID_STREAM_RETRIES})`,
              msg_id,
            });
          }
          return;
        }

        this.onStreamEvent({
          ...data,
          msg_id,
        });
      },
      { onConnectionEvent }
    )
      .then(async () => {
        // If invalid_stream detected and can retry, perform retry
        if (invalidStreamDetected && retryCount < MAX_INVALID_STREAM_RETRIES && query && !abortController.signal.aborted) {
          console.log(`[GeminiAgent] Retrying after invalid stream (attempt ${retryCount + 1})`);

          // Delay before retry
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

          if (abortController.signal.aborted) {
            return;
          }

          // Re-send message
          const prompt_id = this.config.getSessionId() + '########' + getPromptCount();
          const newStream = this.geminiClient.sendMessageStream(query, abortController.signal, prompt_id);
          return this.handleMessage(newStream, msg_id, abortController, query, retryCount + 1);
        }

        // If invalid_stream detected but can't retry, show final error
        if (invalidStreamDetected && retryCount >= MAX_INVALID_STREAM_RETRIES) {
          this.onStreamEvent({
            type: 'error',
            data: 'Invalid response stream detected after multiple retries. Please try again.',
            msg_id,
          });
          return;
        }

        if (toolCallRequests.length > 0) {
          // Emit preview_open for navigation tools, but don't block execution
          // Agent needs chrome-devtools to fetch web page content
          this.emitPreviewForNavigationTools(toolCallRequests, msg_id);

          // Schedule ALL tool requests including chrome-devtools
          await this.scheduler.schedule(toolCallRequests, abortController.signal);
        }
      })
      .catch((e: unknown) => {
        const rawMessage = e instanceof Error ? e.message : JSON.stringify(e);
        const errorMessage = this.enrichErrorMessage(rawMessage);
        // Clean up protected tool calls on error
        for (const req of toolCallRequests) {
          globalToolCallGuard.unprotect(req.callId);
        }
        this.onStreamEvent({
          type: 'error',
          data: errorMessage,
          msg_id,
        });
      });
  }

  /**
   * Check if it's a navigation tool call (supports both with and without MCP prefix)
   *
   * Delegates to NavigationInterceptor for unified logic
   */
  private isNavigationTool(toolName: string): boolean {
    return NavigationInterceptor.isNavigationTool(toolName);
  }

  /**
   * Emit preview_open events for navigation tools without blocking execution
   *
   * Agent needs chrome-devtools to fetch web page content, so we only emit
   * preview events to show URL in preview panel, while letting tools execute normally.
   */
  private emitPreviewForNavigationTools(toolCallRequests: ToolCallRequestInfo[], _msg_id: string): void {
    for (const request of toolCallRequests) {
      const toolName = request.name || '';

      if (this.isNavigationTool(toolName)) {
        const args = request.args || {};
        const url = NavigationInterceptor.extractUrl({ arguments: args as Record<string, unknown> });
        if (url) {
          // Emit preview_open event to show URL in preview panel
          this.onStreamEvent({
            type: 'preview_open',
            data: {
              content: url,
              contentType: 'url',
              metadata: {
                title: url,
              },
            },
            msg_id: uuid(),
          });
        }
      }
    }
  }

  submitQuery(
    query: unknown,
    msg_id: string,
    abortController: AbortController,
    options?: {
      prompt_id?: string;
      isContinuation?: boolean;
    }
  ): string | undefined {
    try {
      this.activeMsgId = msg_id;
      let prompt_id = options?.prompt_id;
      if (!prompt_id) {
        prompt_id = this.config.getSessionId() + '########' + getPromptCount();
      }
      if (!options?.isContinuation) {
        startNewPrompt();
      }

      const stream = this.geminiClient.sendMessageStream(query, abortController.signal, prompt_id);

      // Send start event immediately when stream is created
      this.onStreamEvent({ type: 'start', data: '', msg_id });

      // Pass query to handleMessage for potential retry on invalid stream
      this.handleMessage(stream, msg_id, abortController, query, 0)
        .catch((e: unknown) => {
          const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
          this.onStreamEvent({
            type: 'error',
            data: errorMessage,
            msg_id,
          });
        })
        .finally(() => {
          this.onStreamEvent({
            type: 'finish',
            data: '',
            msg_id,
          });
        });
      return '';
    } catch (e) {
      const rawMessage = e instanceof Error ? e.message : JSON.stringify(e);
      const errorMessage = this.enrichErrorMessage(rawMessage);
      this.onStreamEvent({
        type: 'error',
        data: errorMessage,
        msg_id,
      });
    }
  }

  async send(message: string | Array<{ text: string }>, msg_id = '', files?: string[]) {
    await this.bootstrap;
    const abortController = this.createAbortController();

    const stripFilesMarker = (text: string): string => {
      const markerIndex = text.indexOf(FOUNDRY_FILES_MARKER);
      if (markerIndex === -1) return text;
      return text.slice(0, markerIndex).trimEnd();
    };

    if (Array.isArray(message)) {
      if (message[0]?.text) {
        message[0].text = stripFilesMarker(message[0].text);
      }
    } else if (typeof message === 'string') {
      message = stripFilesMarker(message);
    }

    // Preemptive OAuth Token check (only for OAuth mode)
    if (this.authType === AuthType.LOGIN_WITH_GOOGLE) {
      try {
        const tokenManager = getGlobalTokenManager(this.authType);
        const isTokenValid = await tokenManager.checkAndRefreshIfNeeded();
        if (!isTokenValid) {
          console.warn('[GeminiAgent] OAuth token validation failed, proceeding anyway');
        }
      } catch (tokenError) {
        console.warn('[GeminiAgent] OAuth token check error:', tokenError);
        // Continue execution, let subsequent flow handle auth errors
      }
    }

    // Prepend one-time history prefix before processing commands
    if (this.historyPrefix && !this.historyUsedOnce) {
      if (Array.isArray(message)) {
        const first = message[0];
        const original = first?.text ?? '';
        message = [{ text: `${this.historyPrefix}${original}` }];
      } else if (typeof message === 'string') {
        message = `${this.historyPrefix}${message}`;
      }
      this.historyUsedOnce = true;
    }

    // Skills are loaded via SkillManager, index is already in system instruction
    let skillsPrefix = '';

    if (!this.skillsIndexPrependedOnce) {
      // Prefer presetRules, fallback to contextContent
      const rulesContent = this.presetRules || this.contextContent;
      if (rulesContent) {
        skillsPrefix = `[Assistant Rules - You MUST follow these instructions]\n${rulesContent}\n\n`;
      }
      this.skillsIndexPrependedOnce = true;

      // Inject prefix into message
      if (skillsPrefix) {
        const prefix = skillsPrefix + '[User Request]\n';
        if (Array.isArray(message)) {
          if (message[0]) message[0].text = prefix + message[0].text;
        } else {
          message = prefix + message;
        }
      }
    }

    // Process image files for vision API multimodal support
    const imageParts = await this.processImageFilesForVision(files);

    // Filter out image files - they're sent via vision API, not as file references
    const nonImageFiles = this.filterNonImageFiles(files);

    // Track error messages from @ command processing
    let atCommandError: string | null = null;

    const { processedQuery, shouldProceed } = await handleAtCommand({
      query: Array.isArray(message) ? message[0].text : message,
      config: this.config,
      addItem: (item: unknown) => {
        // Capture error messages from @ command processing
        if (item && typeof item === 'object' && 'type' in item) {
          const typedItem = item as { type: string; text?: string };
          if (typedItem.type === 'error' && typedItem.text) {
            atCommandError = typedItem.text;
          }
        }
      },
      onDebugMessage() {
        // Debug hook intentionally left blank to avoid noisy logging
      },
      messageId: Date.now(),
      signal: abortController.signal,
      // Enable lazy loading only for non-image files (images are sent inline via vision API)
      lazyFileLoading: nonImageFiles.length > 0,
    });

    if (!shouldProceed || processedQuery === null || abortController.signal.aborted) {
      // Send error message to user if @ command processing failed
      if (atCommandError) {
        this.onStreamEvent({
          type: 'error',
          data: atCommandError,
          msg_id,
        });
      } else if (!abortController.signal.aborted) {
        // Generic error if we don't have specific error message
        this.onStreamEvent({
          type: 'error',
          data: 'Failed to process @ file reference. The file may not exist or is not accessible.',
          msg_id,
        });
      }
      // Send finish event so UI can reset state
      this.onStreamEvent({
        type: 'finish',
        data: null,
        msg_id,
      });
      return;
    }

    // Combine text query with image parts for vision API multimodal support
    let finalQuery = processedQuery;
    if (imageParts.length > 0) {
      // processedQuery is already an array of PartUnion
      // Append image parts to create multimodal request
      finalQuery = [...(Array.isArray(processedQuery) ? processedQuery : [processedQuery]), ...imageParts];
    }

    const requestId = this.submitQuery(finalQuery, msg_id, abortController);
    return requestId;
  }
  stop(): void {
    this.abortController?.abort();
  }

  async injectConversationHistory(text: string): Promise<void> {
    try {
      if (!this.config || !this.workspace || !this.settings) return;
      // Prepare one-time prefix for first outgoing message after (re)start
      this.historyPrefix = `Conversation history (recent):\n${text}\n\n`;
      this.historyUsedOnce = false;
      // Use refreshServerHierarchicalMemory to refresh memory, then append chat history
      const { memoryContent } = await refreshServerHierarchicalMemory(this.config);
      const combined = `${memoryContent}\n\n[Recent Chat]\n${text}`;
      this.config.setUserMemory(combined);
    } catch (e) {
      // ignore injection errors
    }
  }
}

/**
 * Get current GeminiAgent instance (used by flashFallbackHandler)
 */
export function getCurrentGeminiAgent(): GeminiAgent | null {
  return currentGeminiAgent;
}
