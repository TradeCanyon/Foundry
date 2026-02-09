/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import type { ToolResult, ToolInvocation, ToolLocation, ToolCallConfirmationDetails, MessageBus } from '@office-ai/aioncli-core';
import { BaseDeclarativeTool, BaseToolInvocation, Kind, getErrorMessage, ToolErrorType } from '@office-ai/aioncli-core';
import { getOrCreateSession, takeScreenshot, SCREENSHOT_MIME_TYPE } from './browser-session';

export interface BrowserFillParams {
  selector: string;
  value: string;
  conversationId: string;
}

export class BrowserFillTool extends BaseDeclarativeTool<BrowserFillParams, ToolResult> {
  static readonly Name = 'foundry_browser_fill';

  constructor(
    messageBus: MessageBus,
    private readonly conversationId: string
  ) {
    super(
      BrowserFillTool.Name,
      'BrowserFill',
      'Fill a form field on the current browser page. Requires user confirmation.\n\nUsage:\n- Provide a CSS selector for the input field\n- Provide the value to type into it\n- A screenshot is taken after filling to show the result',
      Kind.Execute,
      {
        type: Type.OBJECT,
        properties: {
          selector: {
            type: Type.STRING,
            description: 'CSS selector for the input field (e.g. "input[name=\'email\']", "#search-box", "textarea.comment")',
          },
          value: {
            type: Type.STRING,
            description: 'The text value to type into the field',
          },
        },
        required: ['selector', 'value'],
      },
      messageBus,
      true,
      true
    );
  }

  public override validateToolParams(params: BrowserFillParams): string | null {
    if (!params.selector || params.selector.trim() === '') {
      return "The 'selector' parameter cannot be empty.";
    }
    if (params.value === undefined || params.value === null) {
      return "The 'value' parameter is required.";
    }
    return null;
  }

  protected createInvocation(params: BrowserFillParams, messageBus: MessageBus): ToolInvocation<BrowserFillParams, ToolResult> {
    return new BrowserFillInvocation({ ...params, conversationId: this.conversationId }, messageBus);
  }
}

class BrowserFillInvocation extends BaseToolInvocation<BrowserFillParams, ToolResult> {
  constructor(params: BrowserFillParams, messageBus: MessageBus) {
    super(params, messageBus);
  }

  getDescription(): string {
    const preview = this.params.value.length > 50 ? this.params.value.substring(0, 47) + '...' : this.params.value;
    return `Filling "${this.params.selector}" with "${preview}"`;
  }

  override toolLocations(): ToolLocation[] {
    return [];
  }

  override async shouldConfirmExecute(): Promise<ToolCallConfirmationDetails | false> {
    const preview = this.params.value.length > 100 ? this.params.value.substring(0, 97) + '...' : this.params.value;
    return {
      type: 'info',
      title: 'Browser Fill',
      prompt: `Fill "${this.params.selector}" with: ${preview}`,
    } as ToolCallConfirmationDetails;
  }

  async execute(signal: AbortSignal, updateOutput?: (output: string) => void): Promise<ToolResult> {
    if (signal.aborted) {
      return { llmContent: 'Fill cancelled.', returnDisplay: 'Cancelled.' };
    }

    try {
      updateOutput?.(`Filling "${this.params.selector}"...`);
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

      await element.fill(this.params.value);
      await page.waitForTimeout(300);

      updateOutput?.('Taking screenshot after fill...');
      const screenshotBase64 = await takeScreenshot(page);
      const url = page.url();

      const textSummary = `Filled "${this.params.selector}" with "${this.params.value.length > 50 ? this.params.value.substring(0, 47) + '...' : this.params.value}" on ${url}`;

      return {
        llmContent: [{ text: textSummary }, { inlineData: { mimeType: SCREENSHOT_MIME_TYPE, data: screenshotBase64 } }] as any,
        returnDisplay: textSummary,
      };
    } catch (error) {
      if (signal.aborted) {
        return { llmContent: 'Fill cancelled.', returnDisplay: 'Cancelled.' };
      }
      const msg = getErrorMessage(error);
      return {
        llmContent: `Error filling "${this.params.selector}": ${msg}`,
        returnDisplay: `Error: ${msg}`,
        error: { message: msg, type: ToolErrorType.EXECUTION_FAILED },
      };
    }
  }
}
