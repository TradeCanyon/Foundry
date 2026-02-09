/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import type { ToolResult, ToolInvocation, ToolLocation, ToolCallConfirmationDetails, MessageBus } from '@office-ai/aioncli-core';
import { BaseDeclarativeTool, BaseToolInvocation, Kind, getErrorMessage, ToolErrorType } from '@office-ai/aioncli-core';
import { getOrCreateSession, takeScreenshot, SCREENSHOT_MIME_TYPE } from './browser-session';

const DEFAULT_WAIT_TIMEOUT_MS = 10000;

export interface BrowserWaitParams {
  /** What to wait for: 'selector', 'navigation', or 'load' */
  event: string;
  /** CSS selector (required when event is 'selector') */
  selector?: string;
  /** Timeout in milliseconds (default 10000) */
  timeout?: number;
  conversationId: string;
}

export class BrowserWaitTool extends BaseDeclarativeTool<BrowserWaitParams, ToolResult> {
  static readonly Name = 'foundry_browser_wait';

  constructor(
    messageBus: MessageBus,
    private readonly conversationId: string
  ) {
    super(
      BrowserWaitTool.Name,
      'BrowserWait',
      'Wait for a condition on the current browser page.\n\nSupported events:\n- "selector" — wait for a CSS selector to appear (requires selector param)\n- "navigation" — wait for the next navigation to complete\n- "load" — wait for network idle (all resources loaded)\n\nA screenshot is taken after the wait completes.',
      Kind.Other,
      {
        type: Type.OBJECT,
        properties: {
          event: {
            type: Type.STRING,
            description: 'What to wait for: "selector", "navigation", or "load"',
          },
          selector: {
            type: Type.STRING,
            description: 'CSS selector to wait for (required when event is "selector")',
          },
          timeout: {
            type: Type.NUMBER,
            description: 'Timeout in milliseconds (default 10000)',
          },
        },
        required: ['event'],
      },
      messageBus,
      true,
      true
    );
  }

  public override validateToolParams(params: BrowserWaitParams): string | null {
    const validEvents = ['selector', 'navigation', 'load'];
    if (!validEvents.includes(params.event)) {
      return `Invalid event "${params.event}". Must be one of: ${validEvents.join(', ')}`;
    }
    if (params.event === 'selector' && (!params.selector || params.selector.trim() === '')) {
      return "The 'selector' parameter is required when event is 'selector'.";
    }
    if (params.timeout !== undefined && (params.timeout < 0 || params.timeout > 60000)) {
      return 'Timeout must be between 0 and 60000 ms.';
    }
    return null;
  }

  protected createInvocation(params: BrowserWaitParams, messageBus: MessageBus): ToolInvocation<BrowserWaitParams, ToolResult> {
    return new BrowserWaitInvocation({ ...params, conversationId: this.conversationId }, messageBus);
  }
}

class BrowserWaitInvocation extends BaseToolInvocation<BrowserWaitParams, ToolResult> {
  constructor(params: BrowserWaitParams, messageBus: MessageBus) {
    super(params, messageBus);
  }

  getDescription(): string {
    if (this.params.event === 'selector') {
      return `Waiting for "${this.params.selector}" to appear`;
    }
    return `Waiting for ${this.params.event}`;
  }

  override toolLocations(): ToolLocation[] {
    return [];
  }

  override async shouldConfirmExecute(): Promise<ToolCallConfirmationDetails | false> {
    return false;
  }

  async execute(signal: AbortSignal, updateOutput?: (output: string) => void): Promise<ToolResult> {
    if (signal.aborted) {
      return { llmContent: 'Wait cancelled.', returnDisplay: 'Cancelled.' };
    }

    const timeout = this.params.timeout ?? DEFAULT_WAIT_TIMEOUT_MS;

    try {
      const session = await getOrCreateSession(this.params.conversationId);
      const { page } = session;

      switch (this.params.event) {
        case 'selector': {
          updateOutput?.(`Waiting for "${this.params.selector}"...`);
          await page.waitForSelector(this.params.selector!, { timeout });
          break;
        }
        case 'navigation': {
          updateOutput?.('Waiting for navigation...');
          await page.waitForNavigation({ timeout });
          break;
        }
        case 'load': {
          updateOutput?.('Waiting for network idle...');
          await page.waitForLoadState('networkidle', { timeout });
          break;
        }
      }

      updateOutput?.('Taking screenshot after wait...');
      const screenshotBase64 = await takeScreenshot(page);
      const url = page.url();
      const title = await page.title();

      const desc = this.params.event === 'selector' ? `Selector "${this.params.selector}" appeared` : `${this.params.event} completed`;
      const textSummary = `${desc} on ${url} (${title})`;

      return {
        llmContent: [{ text: textSummary }, { inlineData: { mimeType: SCREENSHOT_MIME_TYPE, data: screenshotBase64 } }] as any,
        returnDisplay: textSummary,
      };
    } catch (error) {
      if (signal.aborted) {
        return { llmContent: 'Wait cancelled.', returnDisplay: 'Cancelled.' };
      }
      const msg = getErrorMessage(error);
      return {
        llmContent: `Wait timed out or failed: ${msg}`,
        returnDisplay: `Error: ${msg}`,
        error: { message: msg, type: ToolErrorType.EXECUTION_FAILED },
      };
    }
  }
}
