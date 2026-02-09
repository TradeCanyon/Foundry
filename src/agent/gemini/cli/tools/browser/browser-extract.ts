/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import type { ToolResult, ToolInvocation, ToolLocation, ToolCallConfirmationDetails, MessageBus } from '@office-ai/aioncli-core';
import { BaseDeclarativeTool, BaseToolInvocation, Kind, getErrorMessage, ToolErrorType } from '@office-ai/aioncli-core';
import { getOrCreateSession } from './browser-session';

const MAX_EXTRACT_LENGTH = 100000;

export interface BrowserExtractParams {
  selector?: string;
  conversationId: string;
}

export class BrowserExtractTool extends BaseDeclarativeTool<BrowserExtractParams, ToolResult> {
  static readonly Name = 'foundry_browser_extract';

  constructor(
    messageBus: MessageBus,
    private readonly conversationId: string
  ) {
    super(
      BrowserExtractTool.Name,
      'BrowserExtract',
      'Extract text content from the current browser page or a specific element.\n\nUsage:\n- Call with no selector to extract the full page text\n- Provide a CSS selector to extract text from a specific element',
      Kind.Fetch,
      {
        type: Type.OBJECT,
        properties: {
          selector: {
            type: Type.STRING,
            description: 'Optional CSS selector to extract text from a specific element. If omitted, extracts full page text.',
          },
        },
        required: [],
      },
      messageBus,
      true,
      true
    );
  }

  public override validateToolParams(_params: BrowserExtractParams): string | null {
    return null;
  }

  protected createInvocation(params: BrowserExtractParams, messageBus: MessageBus): ToolInvocation<BrowserExtractParams, ToolResult> {
    return new BrowserExtractInvocation({ ...params, conversationId: this.conversationId }, messageBus);
  }
}

class BrowserExtractInvocation extends BaseToolInvocation<BrowserExtractParams, ToolResult> {
  constructor(params: BrowserExtractParams, messageBus: MessageBus) {
    super(params, messageBus);
  }

  getDescription(): string {
    return this.params.selector ? `Extracting text from "${this.params.selector}"` : 'Extracting full page text';
  }

  override toolLocations(): ToolLocation[] {
    return [];
  }

  override async shouldConfirmExecute(): Promise<ToolCallConfirmationDetails | false> {
    return false;
  }

  async execute(signal: AbortSignal, updateOutput?: (output: string) => void): Promise<ToolResult> {
    if (signal.aborted) {
      return { llmContent: 'Extraction cancelled.', returnDisplay: 'Cancelled.' };
    }

    try {
      const session = await getOrCreateSession(this.params.conversationId);
      const { page } = session;
      const url = page.url();

      let text: string;

      if (this.params.selector) {
        updateOutput?.(`Extracting text from "${this.params.selector}"...`);
        const element = await page.$(this.params.selector);
        if (!element) {
          return {
            llmContent: `No element found matching selector: ${this.params.selector}`,
            returnDisplay: `No element found: ${this.params.selector}`,
            error: { message: `Selector not found: ${this.params.selector}`, type: ToolErrorType.EXECUTION_FAILED },
          };
        }
        text = (await element.innerText()) || '';
      } else {
        updateOutput?.('Extracting full page text...');
        text = await page.evaluate(() => {
          const remove = ['nav', 'footer', 'header', '.cookie-banner', '[role="banner"]', '[role="navigation"]'];
          // Clone body to avoid mutating the live DOM
          const clone = document.body.cloneNode(true) as HTMLElement;
          remove.forEach((sel) => clone.querySelectorAll(sel).forEach((el) => el.remove()));
          return clone.innerText;
        });
      }

      if (!text?.trim()) {
        return {
          llmContent: `Page content is empty at ${url}`,
          returnDisplay: 'Page content is empty.',
        };
      }

      const truncated = text.substring(0, MAX_EXTRACT_LENGTH);
      const suffix = text.length > MAX_EXTRACT_LENGTH ? `\n\n[Truncated: ${text.length} chars total]` : '';

      return {
        llmContent: `Text extracted from ${url}:\n\n${truncated}${suffix}`,
        returnDisplay: `Extracted ${truncated.length} chars from ${url}`,
      };
    } catch (error) {
      if (signal.aborted) {
        return { llmContent: 'Extraction cancelled.', returnDisplay: 'Cancelled.' };
      }
      const msg = getErrorMessage(error);
      return {
        llmContent: `Error extracting text: ${msg}`,
        returnDisplay: `Error: ${msg}`,
        error: { message: msg, type: ToolErrorType.EXECUTION_FAILED },
      };
    }
  }
}
