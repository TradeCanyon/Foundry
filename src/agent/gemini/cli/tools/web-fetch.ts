/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import type { GeminiClient, ToolResult, ToolInvocation, ToolLocation, ToolCallConfirmationDetails, MessageBus } from '@office-ai/aioncli-core';
import { BaseDeclarativeTool, BaseToolInvocation, Kind, getErrorMessage, ToolErrorType, getResponseText, DEFAULT_GEMINI_FLASH_MODEL } from '@office-ai/aioncli-core';
import { convert } from 'html-to-text';
import { chromium, type Browser } from 'playwright-core';

const FETCH_TIMEOUT_MS = 15000;
const PLAYWRIGHT_TIMEOUT_MS = 25000;
const MAX_CONTENT_LENGTH = 100000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function isQuotaError(error: unknown): boolean {
  const msg = String(error).toLowerCase();
  return msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota') || msg.includes('rate limit');
}

// Detect when fetched content is actually a block/captcha page
function isBlockedContent(content: string): boolean {
  const lower = content.toLowerCase();
  const blockIndicators = ['captcha', 'please verify you are a human', 'access denied', 'forbidden', 'enable javascript', 'please enable cookies', 'checking your browser', 'one more step', 'security check', 'unusual traffic', 'are you a robot', 'cloudflare', 'just a moment', 'ray id'];
  const matches = blockIndicators.filter((indicator) => lower.includes(indicator));
  if (matches.length >= 2) return true;
  if (matches.length >= 1 && content.trim().length < 500) return true;
  return false;
}

// Clean up raw page content that might have broken markdown-like characters
function sanitizeRawContent(text: string): string {
  return (
    text
      // Fix broken bold/italic from scraped content (e.g., "* *(only*" → "(only")
      .replace(/\*\s+\*\(/g, '(')
      .replace(/\*\*\s*\*\*/g, '')
      // Collapse excessive whitespace
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/[ \t]{3,}/g, '  ')
      // Remove zero-width and other invisible characters
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
  );
}

// ---------------------------------------------------------------------------
// Playwright browser singleton — reused across all fetches for performance
// ---------------------------------------------------------------------------
let _browser: Browser | null = null;
let _browserLaunchPromise: Promise<Browser | null> | null = null;
let _browserAvailable = true; // Set to false if no system browser found

async function getOrCreateBrowser(): Promise<Browser> {
  if (!_browserAvailable) throw new Error('No system browser available');
  if (_browser?.isConnected()) return _browser;

  // Prevent multiple concurrent launch attempts
  if (_browserLaunchPromise) {
    const result = await _browserLaunchPromise;
    if (result) return result;
    throw new Error('Browser launch failed');
  }

  _browserLaunchPromise = (async (): Promise<Browser | null> => {
    // Try system browsers: Edge (pre-installed on Windows), Chrome, Chromium
    const channels = process.platform === 'win32' ? ['msedge', 'chrome', 'chromium'] : ['chrome', 'chromium'];

    for (const channel of channels) {
      try {
        _browser = await chromium.launch({
          channel,
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
        });

        _browser.on('disconnected', () => {
          _browser = null;
          _browserLaunchPromise = null;
        });

        return _browser;
      } catch {
        continue;
      }
    }

    // No system browser found — disable Playwright for this session
    _browserAvailable = false;
    return null;
  })();

  try {
    const result = await _browserLaunchPromise;
    if (!result) throw new Error('No system browser found (Chrome, Edge, or Chromium required)');
    return result;
  } catch (e) {
    _browserLaunchPromise = null;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Strategy 1: Playwright (local browser with stealth — bypasses anti-bot, handles JS)
// ---------------------------------------------------------------------------
async function fetchViaPlaywright(url: string, signal: AbortSignal): Promise<string> {
  const browser = await getOrCreateBrowser();
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  const page = await context.newPage();

  // Stealth: remove automation markers before any page loads
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    // Fake Chrome runtime object (sites check for its presence)
    (window as any).chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };
    // Override permissions.query for notifications
    const origQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
    window.navigator.permissions.query = (params: any) => (params.name === 'notifications' ? Promise.resolve({ state: Notification.permission } as PermissionStatus) : origQuery(params));
  });

  // Abort handler — close context if signal fires
  const handleAbort = () => {
    void context.close().catch(() => {});
  };
  signal.addEventListener('abort', handleAbort);

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: PLAYWRIGHT_TIMEOUT_MS,
    });

    if (response && !response.ok()) {
      throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
    }

    // Wait for network to settle (catches lazy-loaded content, Cloudflare challenges)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

    // Extract readable text from the rendered page
    const content = await page.evaluate(() => {
      // Remove noise elements before extracting text
      const remove = ['nav', 'footer', 'header', '.cookie-banner', '[role="banner"]', '[role="navigation"]'];
      remove.forEach((sel) => document.querySelectorAll(sel).forEach((el) => el.remove()));
      return document.body.innerText;
    });

    if (!content?.trim()) {
      throw new Error('Page content was empty after rendering');
    }

    return content.substring(0, MAX_CONTENT_LENGTH);
  } finally {
    signal.removeEventListener('abort', handleAbort);
    await context.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Strategy 2: Jina Reader API (fast, server-side rendering)
// ---------------------------------------------------------------------------
async function fetchViaJina(url: string, signal: AbortSignal): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const handleAbort = () => controller.abort();
  signal.addEventListener('abort', handleAbort);

  try {
    const response = await fetch(jinaUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'text/plain',
        'User-Agent': USER_AGENT,
        'X-Return-Format': 'text',
      },
    });

    if (!response.ok) {
      throw new Error(`Jina Reader HTTP ${response.status}`);
    }

    const content = (await response.text()).substring(0, MAX_CONTENT_LENGTH);
    if (!content.trim()) {
      throw new Error('Jina Reader returned empty content');
    }

    return content;
  } finally {
    clearTimeout(timeoutId);
    signal.removeEventListener('abort', handleAbort);
  }
}

// ---------------------------------------------------------------------------
// Strategy 3: Direct fetch + html-to-text (simplest, for plain pages)
// ---------------------------------------------------------------------------
async function fetchDirect(url: string, signal: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const handleAbort = () => controller.abort();
  signal.addEventListener('abort', handleAbort);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const text = convert(html, {
      wordwrap: false,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' },
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'nav', format: 'skip' },
        { selector: 'footer', format: 'skip' },
      ],
    });

    if (!text.trim()) {
      throw new Error('Page content was empty after conversion');
    }

    return text.substring(0, MAX_CONTENT_LENGTH);
  } finally {
    clearTimeout(timeoutId);
    signal.removeEventListener('abort', handleAbort);
  }
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------
function transformUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    if ((parsedUrl.hostname === 'github.com' || parsedUrl.hostname === 'www.github.com') && parsedUrl.pathname.includes('/blob/')) {
      return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }
  } catch {
    // Invalid URL, return as-is
  }
  return url;
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------
export interface WebFetchToolParams {
  url: string;
  prompt: string;
}

export class WebFetchTool extends BaseDeclarativeTool<WebFetchToolParams, ToolResult> {
  static readonly Name: string = 'foundry_web_fetch';

  constructor(
    private readonly geminiClient: GeminiClient,
    messageBus: MessageBus
  ) {
    super(
      WebFetchTool.Name,
      'WebFetch',
      "Fetches content from a specified URL and processes it using an AI model\n- Takes a URL and a prompt as input\n- Fetches the URL content, converts HTML to markdown\n- Processes the content with the prompt using a small, fast model\n- Returns the model's response about the content\n- Use this tool when you need to retrieve and analyze web content\n\nUsage notes:\n  - The URL must be a fully-formed valid URL\n  - The prompt should describe what information you want to extract from the page\n  - This tool is read-only and does not modify any files\n  - Results may be summarized if the content is very large",
      Kind.Fetch,
      {
        type: Type.OBJECT,
        properties: {
          url: {
            type: Type.STRING,
            description: 'The URL to fetch content from',
          },
          prompt: {
            type: Type.STRING,
            description: 'The prompt to run on the fetched content',
          },
        },
        required: ['url', 'prompt'],
      },
      messageBus,
      true, // isOutputMarkdown
      true // canUpdateOutput
    );
  }

  public override validateToolParams(params: WebFetchToolParams): string | null {
    if (!params.url || params.url.trim() === '') {
      return "The 'url' parameter cannot be empty.";
    }
    if (!params.url.startsWith('http://') && !params.url.startsWith('https://')) {
      return "The 'url' must start with http:// or https://.";
    }
    if (!params.prompt || params.prompt.trim() === '') {
      return "The 'prompt' parameter cannot be empty.";
    }
    return null;
  }

  protected createInvocation(params: WebFetchToolParams, messageBus: MessageBus, _toolName?: string, _toolDisplayName?: string): ToolInvocation<WebFetchToolParams, ToolResult> {
    return new WebFetchInvocation(this.geminiClient, params, messageBus, _toolName, _toolDisplayName);
  }
}

class WebFetchInvocation extends BaseToolInvocation<WebFetchToolParams, ToolResult> {
  constructor(
    private readonly geminiClient: GeminiClient,
    params: WebFetchToolParams,
    messageBus: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string
  ) {
    super(params, messageBus, _toolName, _toolDisplayName);
  }

  getDescription(): string {
    const displayPrompt = this.params.prompt.length > 100 ? this.params.prompt.substring(0, 97) + '...' : this.params.prompt;
    return `Fetching content from ${this.params.url} and processing with prompt: "${displayPrompt}"`;
  }

  override toolLocations(): ToolLocation[] {
    return [];
  }

  override async shouldConfirmExecute(): Promise<ToolCallConfirmationDetails | false> {
    return false;
  }

  async execute(signal: AbortSignal, updateOutput?: (output: string) => void): Promise<ToolResult> {
    if (signal.aborted) {
      return {
        llmContent: 'Web fetch was cancelled by user before it could start.',
        returnDisplay: 'Operation cancelled by user.',
      };
    }

    try {
      const url = transformUrl(this.params.url);
      updateOutput?.(`Fetching ${url}...`);

      let pageContent: string | null = null;
      let fetchMethod = '';

      // 1. Playwright — local browser, bypasses anti-bot, handles JS rendering
      if (!signal.aborted) {
        try {
          updateOutput?.('Loading page in browser...');
          const result = await fetchViaPlaywright(url, signal);
          if (isBlockedContent(result)) {
            updateOutput?.('Browser got blocked page, trying Jina...');
          } else {
            pageContent = result;
            fetchMethod = 'browser';
            updateOutput?.('Page loaded via browser');
          }
        } catch (e) {
          updateOutput?.(`Browser failed: ${getErrorMessage(e)}, trying Jina...`);
        }
      }

      // 2. Jina Reader — fast server-side fallback
      if (!pageContent?.trim() && !signal.aborted) {
        try {
          const result = await fetchViaJina(url, signal);
          if (isBlockedContent(result)) {
            updateOutput?.('Jina got blocked content, trying direct fetch...');
          } else {
            pageContent = result;
            fetchMethod = 'jina';
            updateOutput?.('Content retrieved via Jina Reader');
          }
        } catch (e) {
          updateOutput?.(`Jina failed: ${getErrorMessage(e)}, trying direct fetch...`);
        }
      }

      // 3. Direct fetch — simplest approach, last resort
      if (!pageContent?.trim() && !signal.aborted) {
        try {
          const result = await fetchDirect(url, signal);
          if (isBlockedContent(result)) {
            updateOutput?.('Direct fetch also got blocked content');
          } else {
            pageContent = result;
            fetchMethod = 'direct';
            updateOutput?.('Content retrieved via direct fetch');
          }
        } catch (e) {
          updateOutput?.(`Direct fetch also failed: ${getErrorMessage(e)}`);
        }
      }

      if (!pageContent?.trim()) {
        return {
          llmContent: `Error: Could not fetch content from ${url}. The site may block automated access or require authentication.`,
          returnDisplay: `Error: Could not fetch ${url}`,
          error: {
            message: 'All fetch strategies failed for this URL',
            type: ToolErrorType.EXECUTION_FAILED,
          },
        };
      }

      // Process with Gemini Flash for a structured answer
      updateOutput?.(`Analyzing content from ${url} (via ${fetchMethod})...`);
      let resultText = '';
      try {
        const processPrompt = `The user requested: "${this.params.prompt}"

Content fetched from ${url}:
---
${pageContent}
---

Instructions:
- Answer the user's request using ONLY the content above.
- Use clean, well-formatted markdown. No duplicated text or broken characters.
- Format numbers, prices, and financial data cleanly (e.g., $41,990 not $41, 990).
- Be concise and focused. Omit navigation menus, cookie notices, and boilerplate.`;
        const result = await this.geminiClient.generateContent({ model: DEFAULT_GEMINI_FLASH_MODEL }, [{ role: 'user', parts: [{ text: processPrompt }] }], signal);
        resultText = getResponseText(result) || '';
      } catch (processingError) {
        if (isQuotaError(processingError)) {
          updateOutput?.('API quota exhausted — returning raw content');
          const truncated = sanitizeRawContent(pageContent.substring(0, 15000));
          return {
            llmContent: `[Gemini API quota exhausted — raw page content below]\n\nSource: ${url}\n\n${truncated}`,
            returnDisplay: `Fetched ${url} (API quota hit, raw content returned)`,
          };
        }
        // Processing failed but we have content — return it raw
        updateOutput?.('Processing failed — returning raw content');
      }

      updateOutput?.('Fetch completed successfully');

      return {
        llmContent: resultText || sanitizeRawContent(pageContent.substring(0, 15000)),
        returnDisplay: `Content from ${url} processed successfully.`,
      };
    } catch (error) {
      if (signal.aborted) {
        return {
          llmContent: 'Web fetch was cancelled by user.',
          returnDisplay: 'Operation cancelled by user.',
        };
      }

      if (isQuotaError(error)) {
        return {
          llmContent: 'Error: Gemini API quota exhausted (429). Please wait for quota to reset or upgrade your API plan.',
          returnDisplay: 'API quota exhausted (429). Wait for reset or upgrade plan.',
          error: {
            message: 'Gemini API quota exhausted (429)',
            type: ToolErrorType.EXECUTION_FAILED,
          },
        };
      }

      const errorMessage = getErrorMessage(error);
      return {
        llmContent: `Error fetching ${this.params.url}: ${errorMessage}`,
        returnDisplay: `Error: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}
