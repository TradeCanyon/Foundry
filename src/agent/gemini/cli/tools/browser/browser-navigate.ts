/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import type { ToolResult, ToolInvocation, ToolLocation, ToolCallConfirmationDetails, MessageBus } from '@office-ai/aioncli-core';
import { BaseDeclarativeTool, BaseToolInvocation, Kind, getErrorMessage, ToolErrorType } from '@office-ai/aioncli-core';
import { getOrCreateSession, takeScreenshot, SCREENSHOT_MIME_TYPE } from './browser-session';

const NAVIGATE_TIMEOUT_MS = 30000;

export interface BrowserNavigateParams {
  url: string;
  conversationId: string;
}

export class BrowserNavigateTool extends BaseDeclarativeTool<BrowserNavigateParams, ToolResult> {
  static readonly Name = 'foundry_browser_navigate';

  constructor(
    messageBus: MessageBus,
    private readonly conversationId: string
  ) {
    super(
      BrowserNavigateTool.Name,
      'BrowserNavigate',
      'Navigate the browser to a URL. Returns a screenshot of the loaded page.\n\nUsage:\n- Provide a fully-formed URL (https://...)\n- The browser persists across tool calls within this conversation\n- A screenshot is automatically taken after navigation',
      Kind.Fetch,
      {
        type: Type.OBJECT,
        properties: {
          url: {
            type: Type.STRING,
            description: 'The URL to navigate to (must start with http:// or https://)',
          },
        },
        required: ['url'],
      },
      messageBus,
      true,
      true
    );
  }

  public override validateToolParams(params: BrowserNavigateParams): string | null {
    if (!params.url || params.url.trim() === '') {
      return "The 'url' parameter cannot be empty.";
    }
    if (!params.url.startsWith('http://') && !params.url.startsWith('https://')) {
      return "The 'url' must start with http:// or https://.";
    }
    return null;
  }

  protected createInvocation(params: BrowserNavigateParams, messageBus: MessageBus): ToolInvocation<BrowserNavigateParams, ToolResult> {
    return new BrowserNavigateInvocation({ ...params, conversationId: this.conversationId }, messageBus);
  }
}

class BrowserNavigateInvocation extends BaseToolInvocation<BrowserNavigateParams, ToolResult> {
  constructor(params: BrowserNavigateParams, messageBus: MessageBus) {
    super(params, messageBus);
  }

  getDescription(): string {
    return `Navigating browser to ${this.params.url}`;
  }

  override toolLocations(): ToolLocation[] {
    return [];
  }

  override async shouldConfirmExecute(): Promise<ToolCallConfirmationDetails | false> {
    return false;
  }

  async execute(signal: AbortSignal, updateOutput?: (output: string) => void): Promise<ToolResult> {
    if (signal.aborted) {
      return { llmContent: 'Navigation cancelled.', returnDisplay: 'Cancelled.' };
    }

    try {
      updateOutput?.(`Navigating to ${this.params.url}...`);
      const session = await getOrCreateSession(this.params.conversationId);
      const { page } = session;

      const response = await page.goto(this.params.url, {
        waitUntil: 'domcontentloaded',
        timeout: NAVIGATE_TIMEOUT_MS,
      });

      // Wait for network to settle
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

      const statusCode = response?.status() ?? 0;
      const title = await page.title();

      updateOutput?.('Taking screenshot...');
      const screenshotBase64 = await takeScreenshot(page);

      const textSummary = `Navigated to ${this.params.url}\nTitle: ${title}\nStatus: ${statusCode}`;

      return {
        llmContent: [{ text: textSummary }, { inlineData: { mimeType: SCREENSHOT_MIME_TYPE, data: screenshotBase64 } }] as any,
        returnDisplay: textSummary,
      };
    } catch (error) {
      if (signal.aborted) {
        return { llmContent: 'Navigation cancelled.', returnDisplay: 'Cancelled.' };
      }
      const msg = getErrorMessage(error);
      return {
        llmContent: `Error navigating to ${this.params.url}: ${msg}`,
        returnDisplay: `Error: ${msg}`,
        error: { message: msg, type: ToolErrorType.EXECUTION_FAILED },
      };
    }
  }
}
