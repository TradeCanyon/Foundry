/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import type { ToolResult, ToolInvocation, ToolLocation, ToolCallConfirmationDetails, MessageBus } from '@office-ai/aioncli-core';
import { BaseDeclarativeTool, BaseToolInvocation, Kind, getErrorMessage, ToolErrorType } from '@office-ai/aioncli-core';
import { getOrCreateSession, takeScreenshot, SCREENSHOT_MIME_TYPE } from './browser-session';

export interface BrowserClickParams {
  selector: string;
  conversationId: string;
}

export class BrowserClickTool extends BaseDeclarativeTool<BrowserClickParams, ToolResult> {
  static readonly Name = 'foundry_browser_click';

  constructor(
    messageBus: MessageBus,
    private readonly conversationId: string
  ) {
    super(
      BrowserClickTool.Name,
      'BrowserClick',
      'Click an element on the current browser page. Requires user confirmation.\n\nUsage:\n- Provide a CSS selector for the element to click\n- A screenshot is taken after the click to show the result',
      Kind.Execute,
      {
        type: Type.OBJECT,
        properties: {
          selector: {
            type: Type.STRING,
            description: 'CSS selector for the element to click (e.g. "button.submit", "#login-btn", "a[href=\'/about\']")',
          },
        },
        required: ['selector'],
      },
      messageBus,
      true,
      true
    );
  }

  public override validateToolParams(params: BrowserClickParams): string | null {
    if (!params.selector || params.selector.trim() === '') {
      return "The 'selector' parameter cannot be empty.";
    }
    return null;
  }

  protected createInvocation(params: BrowserClickParams, messageBus: MessageBus): ToolInvocation<BrowserClickParams, ToolResult> {
    return new BrowserClickInvocation({ ...params, conversationId: this.conversationId }, messageBus);
  }
}

class BrowserClickInvocation extends BaseToolInvocation<BrowserClickParams, ToolResult> {
  constructor(params: BrowserClickParams, messageBus: MessageBus) {
    super(params, messageBus);
  }

  getDescription(): string {
    return `Clicking element: ${this.params.selector}`;
  }

  override toolLocations(): ToolLocation[] {
    return [];
  }

  override async shouldConfirmExecute(): Promise<ToolCallConfirmationDetails | false> {
    return {
      type: 'info',
      title: 'Browser Click',
      prompt: `Click element matching: ${this.params.selector}`,
    } as ToolCallConfirmationDetails;
  }

  async execute(signal: AbortSignal, updateOutput?: (output: string) => void): Promise<ToolResult> {
    if (signal.aborted) {
      return { llmContent: 'Click cancelled.', returnDisplay: 'Cancelled.' };
    }

    try {
      updateOutput?.(`Clicking "${this.params.selector}"...`);
      const session = await getOrCreateSession(this.params.conversationId);
      const { page } = session;

      const element = await page.$(this.params.selector);
      if (!element) {
        return {
          llmContent: `No element found matching selector: ${this.params.selector}`,
          returnDisplay: `Element not found: ${this.params.selector}`,
          error: { message: `Selector not found: ${this.params.selector}`, type: ToolErrorType.EXECUTION_FAILED },
        };
      }

      await element.click();

      // Wait briefly for any navigation or DOM updates
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);

      updateOutput?.('Taking screenshot after click...');
      const screenshotBase64 = await takeScreenshot(page);
      const url = page.url();
      const title = await page.title();

      const textSummary = `Clicked "${this.params.selector}" on ${url} (${title})`;

      return {
        llmContent: [{ text: textSummary }, { inlineData: { mimeType: SCREENSHOT_MIME_TYPE, data: screenshotBase64 } }] as any,
        returnDisplay: textSummary,
      };
    } catch (error) {
      if (signal.aborted) {
        return { llmContent: 'Click cancelled.', returnDisplay: 'Cancelled.' };
      }
      const msg = getErrorMessage(error);
      return {
        llmContent: `Error clicking "${this.params.selector}": ${msg}`,
        returnDisplay: `Error: ${msg}`,
        error: { message: msg, type: ToolErrorType.EXECUTION_FAILED },
      };
    }
  }
}
