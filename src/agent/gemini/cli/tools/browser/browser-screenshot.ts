/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import type { ToolResult, ToolInvocation, ToolLocation, ToolCallConfirmationDetails, MessageBus } from '@office-ai/aioncli-core';
import { BaseDeclarativeTool, BaseToolInvocation, Kind, getErrorMessage, ToolErrorType } from '@office-ai/aioncli-core';
import { getOrCreateSession, takeScreenshot, SCREENSHOT_MIME_TYPE } from './browser-session';

export interface BrowserScreenshotParams {
  conversationId: string;
}

export class BrowserScreenshotTool extends BaseDeclarativeTool<BrowserScreenshotParams, ToolResult> {
  static readonly Name = 'foundry_browser_screenshot';

  constructor(
    messageBus: MessageBus,
    private readonly conversationId: string
  ) {
    super(
      BrowserScreenshotTool.Name,
      'BrowserScreenshot',
      'Take a screenshot of the current browser page. Use this to see the current state of the page after interactions.',
      Kind.Read,
      {
        type: Type.OBJECT,
        properties: {},
        required: [],
      },
      messageBus,
      true,
      true
    );
  }

  public override validateToolParams(_params: BrowserScreenshotParams): string | null {
    return null;
  }

  protected createInvocation(params: BrowserScreenshotParams, messageBus: MessageBus): ToolInvocation<BrowserScreenshotParams, ToolResult> {
    return new BrowserScreenshotInvocation({ ...params, conversationId: this.conversationId }, messageBus);
  }
}

class BrowserScreenshotInvocation extends BaseToolInvocation<BrowserScreenshotParams, ToolResult> {
  constructor(params: BrowserScreenshotParams, messageBus: MessageBus) {
    super(params, messageBus);
  }

  getDescription(): string {
    return 'Taking screenshot of current page';
  }

  override toolLocations(): ToolLocation[] {
    return [];
  }

  override async shouldConfirmExecute(): Promise<ToolCallConfirmationDetails | false> {
    return false;
  }

  async execute(signal: AbortSignal, updateOutput?: (output: string) => void): Promise<ToolResult> {
    if (signal.aborted) {
      return { llmContent: 'Screenshot cancelled.', returnDisplay: 'Cancelled.' };
    }

    try {
      updateOutput?.('Taking screenshot...');
      const session = await getOrCreateSession(this.params.conversationId);
      const { page } = session;

      const url = page.url();
      const title = await page.title();
      const screenshotBase64 = await takeScreenshot(page);

      const textSummary = `Screenshot of ${url} (${title})`;

      return {
        llmContent: [{ text: textSummary }, { inlineData: { mimeType: SCREENSHOT_MIME_TYPE, data: screenshotBase64 } }] as any,
        returnDisplay: textSummary,
      };
    } catch (error) {
      if (signal.aborted) {
        return { llmContent: 'Screenshot cancelled.', returnDisplay: 'Cancelled.' };
      }
      const msg = getErrorMessage(error);
      return {
        llmContent: `Error taking screenshot: ${msg}`,
        returnDisplay: `Error: ${msg}`,
        error: { message: msg, type: ToolErrorType.EXECUTION_FAILED },
      };
    }
  }
}
