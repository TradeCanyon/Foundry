/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import type { GeminiClient, ToolResult, ToolInvocation, ToolLocation, ToolCallConfirmationDetails, MessageBus } from '@office-ai/aioncli-core';
import { BaseDeclarativeTool, BaseToolInvocation, Kind, getErrorMessage, ToolErrorType, getResponseText, DEFAULT_GEMINI_FLASH_MODEL } from '@office-ai/aioncli-core';
import { convert } from 'html-to-text';

const SEARCH_FETCH_TIMEOUT_MS = 15000;
const MAX_SEARCH_CONTENT = 50000;

const SEARCH_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function isQuotaError(error: unknown): boolean {
  const msg = String(error).toLowerCase();
  return msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota') || msg.includes('rate limit');
}

// Detect when search results are actually blocked/captcha/garbage content
function isBlockedContent(content: string): boolean {
  const lower = content.toLowerCase();
  const blockIndicators = ['captcha', 'please verify you are a human', 'access denied', 'forbidden', 'enable javascript', 'please enable cookies', 'checking your browser', 'one more step', 'security check', 'unusual traffic', 'are you a robot', 'cloudflare', 'just a moment', 'ray id'];
  const matches = blockIndicators.filter((indicator) => lower.includes(indicator));
  // If multiple block indicators or content is very short, it's likely blocked
  if (matches.length >= 2) return true;
  // Very short content with a single block indicator
  if (matches.length >= 1 && content.trim().length < 500) return true;
  return false;
}

/**
 * Jina Search API (s.jina.ai) — purpose-built search endpoint.
 * Returns top-5 results in LLM-friendly text format, no auth needed for basic usage.
 */
async function fetchViaJinaSearch(query: string, signal: AbortSignal): Promise<string> {
  const jinaUrl = `https://s.jina.ai/${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_FETCH_TIMEOUT_MS);
  const handleAbort = () => controller.abort();
  signal.addEventListener('abort', handleAbort);

  try {
    const response = await fetch(jinaUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'text/plain',
        'User-Agent': SEARCH_USER_AGENT,
        'X-Return-Format': 'text',
      },
    });

    if (!response.ok) {
      throw new Error(`Jina Search HTTP ${response.status}`);
    }

    const content = (await response.text()).substring(0, MAX_SEARCH_CONTENT);
    if (!content.trim()) {
      throw new Error('Jina Search returned empty content');
    }

    return content;
  } finally {
    clearTimeout(timeoutId);
    signal.removeEventListener('abort', handleAbort);
  }
}

/**
 * Direct DuckDuckGo HTML fetch — no external API dependency.
 * DuckDuckGo's HTML-only endpoint is lightweight and rarely blocks automated requests.
 */
async function fetchSearchDirect(query: string, signal: AbortSignal): Promise<string> {
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_FETCH_TIMEOUT_MS);
  const handleAbort = () => controller.abort();
  signal.addEventListener('abort', handleAbort);

  try {
    const response = await fetch(ddgUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': SEARCH_USER_AGENT,
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo HTTP ${response.status}`);
    }

    const html = await response.text();
    const text = convert(html, {
      wordwrap: false,
      selectors: [
        { selector: 'a', options: { ignoreHref: false } },
        { selector: 'img', format: 'skip' },
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
      ],
    });

    if (!text.trim()) {
      throw new Error('DuckDuckGo returned empty content');
    }

    return text.substring(0, MAX_SEARCH_CONTENT);
  } finally {
    clearTimeout(timeoutId);
    signal.removeEventListener('abort', handleAbort);
  }
}

interface GroundingChunkWeb {
  uri?: string;
  title?: string;
}

interface GroundingChunkItem {
  web?: GroundingChunkWeb;
}

/**
 * Parameters for the WebSearchTool.
 */
export interface WebSearchToolParams {
  /**
   * The search query.
   */
  query: string;
}

/**
 * Extends ToolResult to include sources for web search.
 */
export interface WebSearchToolResult extends ToolResult {
  sources?: GroundingChunkItem[];
}

/**
 * Custom web search tool — replaces built-in google_web_search for all models.
 * Primary: Jina Search API (s.jina.ai), Fallback: DuckDuckGo direct HTML.
 * Results are processed by Gemini Flash for structured answers.
 */
export class WebSearchTool extends BaseDeclarativeTool<WebSearchToolParams, WebSearchToolResult> {
  static readonly Name: string = 'gemini_web_search';

  constructor(
    private readonly geminiClient: GeminiClient,
    messageBus: MessageBus
  ) {
    super(
      WebSearchTool.Name,
      'GoogleSearch',
      'Performs a web search and returns the results. This tool is useful for finding information on the internet based on a query.',
      Kind.Search,
      {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: 'The search query to find information on the web.',
          },
        },
        required: ['query'],
      },
      messageBus,
      true, // isOutputMarkdown
      true // canUpdateOutput — show search progress in tool summary
    );
  }

  public override validateToolParams(params: WebSearchToolParams): string | null {
    if (!params.query || params.query.trim() === '') {
      return "The 'query' parameter cannot be empty.";
    }
    return null;
  }

  protected createInvocation(params: WebSearchToolParams, messageBus: MessageBus, _toolName?: string, _toolDisplayName?: string): ToolInvocation<WebSearchToolParams, WebSearchToolResult> {
    return new WebSearchInvocation(this.geminiClient, params, messageBus, _toolName, _toolDisplayName);
  }
}

class WebSearchInvocation extends BaseToolInvocation<WebSearchToolParams, WebSearchToolResult> {
  constructor(
    private readonly geminiClient: GeminiClient,
    params: WebSearchToolParams,
    messageBus: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string
  ) {
    super(params, messageBus, _toolName, _toolDisplayName);
  }

  getDescription(): string {
    return `Searching the web for: "${this.params.query}"`;
  }

  override toolLocations(): ToolLocation[] {
    return [];
  }

  override async shouldConfirmExecute(): Promise<ToolCallConfirmationDetails | false> {
    return false;
  }

  async execute(signal: AbortSignal, updateOutput?: (output: string) => void): Promise<WebSearchToolResult> {
    if (signal.aborted) {
      return {
        llmContent: 'Web search was cancelled by user before it could start.',
        returnDisplay: 'Operation cancelled by user.',
      };
    }

    try {
      updateOutput?.(`Searching the web for: "${this.params.query}"`);

      let searchContent: string | null = null;

      // 1. Try Jina Search API (purpose-built search, returns LLM-friendly results)
      if (!signal.aborted) {
        try {
          const result = await fetchViaJinaSearch(this.params.query, signal);
          if (!isBlockedContent(result)) {
            searchContent = result;
          } else {
            updateOutput?.('Jina results blocked, trying DuckDuckGo...');
          }
        } catch {
          updateOutput?.('Jina Search unavailable, trying DuckDuckGo...');
        }
      }

      // 2. Fallback: DuckDuckGo direct HTML (no external API dependency)
      if (!searchContent?.trim() && !signal.aborted) {
        try {
          const result = await fetchSearchDirect(this.params.query, signal);
          if (!isBlockedContent(result)) {
            searchContent = result;
          } else {
            updateOutput?.('DuckDuckGo results also blocked');
          }
        } catch {
          updateOutput?.('DuckDuckGo also unavailable');
        }
      }

      if (!searchContent?.trim()) {
        return {
          llmContent: 'Error: Search engines returned blocked or empty results. The query may need to be rephrased, or try fetching specific URLs directly.',
          returnDisplay: 'Search blocked or empty — try fetching URLs directly.',
          error: {
            message: 'Search results were blocked or empty',
            type: ToolErrorType.EXECUTION_FAILED,
          },
        };
      }

      // Extract source URLs from search content
      const urlMatches = searchContent.match(/https?:\/\/[^\s\)\]>"]+/g) || [];
      const sources: GroundingChunkItem[] = [...new Set(urlMatches)]
        .filter((u) => !u.includes('google.com') && !u.includes('gstatic.com') && !u.includes('googleapis.com') && !u.includes('bing.com') && !u.includes('duckduckgo.com') && !u.includes('jina.ai'))
        .slice(0, 10)
        .map((uri) => ({ web: { uri } }));

      // Try to process with Gemini Flash for a structured answer
      updateOutput?.('Processing search results...');
      let responseText = '';
      try {
        const processPrompt = `Based on these search results for "${this.params.query}", provide a comprehensive answer. Include relevant source URLs from the results where available.\n\nSearch results:\n${searchContent}`;
        const result = await this.geminiClient.generateContent({ model: DEFAULT_GEMINI_FLASH_MODEL }, [{ role: 'user', parts: [{ text: processPrompt }] }], signal);
        responseText = getResponseText(result) || '';
      } catch (processingError) {
        if (isQuotaError(processingError)) {
          // Quota exhausted — return raw search results so the model can still use them
          updateOutput?.('API quota exhausted — returning raw results');
          const truncated = searchContent.substring(0, 15000);
          return {
            llmContent: `[Gemini API quota exhausted — raw search results below]\n\n${truncated}`,
            returnDisplay: `Search results retrieved but API quota exhausted. Raw results returned.`,
            sources,
          };
        }
        // Other processing error — still return raw results
        updateOutput?.('Processing failed — returning raw results');
      }

      // If processing produced nothing, return raw content
      if (!responseText) {
        const truncated = searchContent.substring(0, 15000);
        return {
          llmContent: truncated,
          returnDisplay: `Search results retrieved (unprocessed).`,
          sources,
        };
      }

      let displayContent = responseText;
      if (sources.length > 0) {
        displayContent += '\n\n**Sources:**\n';
        sources.forEach((chunk, index) => {
          if (chunk.web?.uri) {
            displayContent += `${index + 1}. ${chunk.web.uri}\n`;
          }
        });
      }

      updateOutput?.('Search completed successfully');

      return {
        llmContent: responseText,
        returnDisplay: displayContent,
        sources,
      };
    } catch (error) {
      if (signal.aborted) {
        return {
          llmContent: 'Web search was cancelled by user.',
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
          sources: [],
        };
      }

      const errorMessage = getErrorMessage(error);
      return {
        llmContent: `Error performing web search: ${errorMessage}`,
        returnDisplay: `Error: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
        sources: [],
      };
    }
  }
}
