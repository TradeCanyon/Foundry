/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Built-in Tool Handler for Foundry
 *
 * Handles web search and fetch requests that would otherwise fail
 * because CLI agents don't have native implementations.
 *
 * This allows Claude/Gemini/etc. to use web search without OAuth setup.
 */

import { webSearch, formatSearchResultsAsMarkdown, type WebSearchConfig } from './webSearch';
import { webFetch, formatFetchResultAsMarkdown, type WebFetchConfig } from './webFetch';

/**
 * Tool call input structure from ACP
 */
export interface ToolCallInput {
  title?: string;
  kind?: string;
  rawInput?: Record<string, unknown>;
}

/**
 * Result of handling a tool call
 */
export interface ToolHandlerResult {
  handled: boolean;
  result?: string;
  error?: string;
}

/**
 * Tool names that we handle
 * Maps various naming conventions to our handlers
 */
const WEB_SEARCH_PATTERNS = ['websearch', 'web_search', 'web-search', 'googlesearch', 'google_search', 'google-search', 'search', 'internet_search', 'brave_search', 'duckduckgo'];

const WEB_FETCH_PATTERNS = ['webfetch', 'web_fetch', 'web-fetch', 'fetch_url', 'fetch-url', 'url_fetch', 'read_url', 'read-url', 'get_url', 'get-url'];

/**
 * Check if a tool name matches web search patterns
 */
function isWebSearchTool(toolName: string): boolean {
  const normalized = toolName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return WEB_SEARCH_PATTERNS.some((pattern) => {
    const normalizedPattern = pattern.replace(/[^a-z0-9]/g, '');
    return normalized.includes(normalizedPattern) || normalizedPattern.includes(normalized);
  });
}

/**
 * Check if a tool name matches web fetch patterns
 */
function isWebFetchTool(toolName: string): boolean {
  const normalized = toolName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return WEB_FETCH_PATTERNS.some((pattern) => {
    const normalizedPattern = pattern.replace(/[^a-z0-9]/g, '');
    return normalized.includes(normalizedPattern) || normalizedPattern.includes(normalized);
  });
}

/**
 * Extract search query from tool input
 */
function extractSearchQuery(rawInput: Record<string, unknown>): string | null {
  // Try common parameter names
  const possibleKeys = ['query', 'q', 'search', 'search_query', 'searchQuery', 'text', 'input'];

  for (const key of possibleKeys) {
    const value = rawInput[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

/**
 * Extract URL from tool input
 */
function extractUrl(rawInput: Record<string, unknown>): string | null {
  // Try common parameter names
  const possibleKeys = ['url', 'uri', 'link', 'href', 'target', 'address'];

  for (const key of possibleKeys) {
    const value = rawInput[key];
    if (typeof value === 'string' && value.trim().startsWith('http')) {
      return value.trim();
    }
  }

  return null;
}

/**
 * Get web search configuration
 * TODO: Add settings UI to configure Brave API key
 */
function getWebSearchConfig(): WebSearchConfig {
  // For now, use DuckDuckGo with default settings
  // Brave API key can be configured later via settings
  return { maxResults: 10 };
}

/**
 * Handle a web search tool call
 */
async function handleWebSearch(rawInput: Record<string, unknown>): Promise<ToolHandlerResult> {
  const query = extractSearchQuery(rawInput);

  if (!query) {
    return {
      handled: true,
      error: 'No search query provided. Please include a "query" parameter.',
    };
  }

  console.log(`[BuiltinToolHandler] Handling web search: "${query}"`);

  const config = getWebSearchConfig();
  const result = await webSearch(query, config);

  if (result.error) {
    return {
      handled: true,
      error: result.error,
    };
  }

  return {
    handled: true,
    result: formatSearchResultsAsMarkdown(result),
  };
}

/**
 * Handle a web fetch tool call
 */
async function handleWebFetch(rawInput: Record<string, unknown>): Promise<ToolHandlerResult> {
  const url = extractUrl(rawInput);

  if (!url) {
    return {
      handled: true,
      error: 'No URL provided. Please include a "url" parameter.',
    };
  }

  console.log(`[BuiltinToolHandler] Handling web fetch: "${url}"`);

  const config: WebFetchConfig = {
    convertToText: true,
    maxLength: 100000,
  };

  const result = await webFetch(url, config);

  if (result.error) {
    return {
      handled: true,
      error: result.error,
    };
  }

  return {
    handled: true,
    result: formatFetchResultAsMarkdown(result),
  };
}

/**
 * Check if we can handle this tool call and execute if so
 *
 * @param toolCall The tool call from ACP
 * @returns Result indicating if handled and the output
 */
export async function handleBuiltinTool(toolCall: ToolCallInput): Promise<ToolHandlerResult> {
  const toolName = toolCall.title || '';
  const rawInput = toolCall.rawInput || {};

  // Check for web search
  if (isWebSearchTool(toolName)) {
    return handleWebSearch(rawInput);
  }

  // Check for web fetch
  if (isWebFetchTool(toolName)) {
    return handleWebFetch(rawInput);
  }

  // Not a tool we handle
  return { handled: false };
}

/**
 * Check if a tool name is a built-in tool we can handle
 * (without executing it)
 */
export function isBuiltinTool(toolName: string): boolean {
  return isWebSearchTool(toolName) || isWebFetchTool(toolName);
}
