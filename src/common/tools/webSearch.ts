/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Built-in Web Search Service for Foundry
 * Uses DuckDuckGo by default (no API key required)
 * Can be configured to use Brave Search API for better results
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResult {
  query: string;
  results: SearchResult[];
  source: 'duckduckgo' | 'brave' | 'google';
  error?: string;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SEARCH_TIMEOUT_MS = 10000;

/**
 * Search using DuckDuckGo HTML (no API key required)
 * Scrapes the HTML response for search results
 */
async function searchDuckDuckGo(query: string, maxResults = 10): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo search failed: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    return parseDuckDuckGoResults(html, maxResults);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse DuckDuckGo HTML search results
 */
function parseDuckDuckGoResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];

  // DuckDuckGo HTML uses class="result__a" for result links
  // and class="result__snippet" for snippets
  const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
  const snippetPattern = /<a[^>]*class="result__snippet"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;

  // Extract URLs and titles
  const links: Array<{ url: string; title: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = resultPattern.exec(html)) !== null && links.length < maxResults) {
    let url = match[1];
    const title = decodeHTMLEntities(match[2].trim());

    // DuckDuckGo wraps URLs in a redirect, extract the actual URL
    if (url.includes('uddg=')) {
      const uddgMatch = url.match(/uddg=([^&]*)/);
      if (uddgMatch) {
        url = decodeURIComponent(uddgMatch[1]);
      }
    }

    // Skip ads and internal DDG links
    if (url.startsWith('http') && !url.includes('duckduckgo.com')) {
      links.push({ url, title });
    }
  }

  // Extract snippets
  const snippets: string[] = [];
  while ((match = snippetPattern.exec(html)) !== null && snippets.length < maxResults) {
    // Clean HTML tags from snippet
    const snippet = decodeHTMLEntities(match[1].replace(/<[^>]*>/g, '').trim());
    snippets.push(snippet);
  }

  // Combine links and snippets
  for (let i = 0; i < links.length && results.length < maxResults; i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || '',
    });
  }

  return results;
}

/**
 * Decode HTML entities including named, decimal, and hex entities
 */
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    // Basic entities
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&#x27;': "'",
    '&#x2F;': '/',
    // Currency symbols
    '&dollar;': '$',
    '&euro;': '\u20AC',
    '&pound;': '\u00A3',
    '&yen;': '\u00A5',
    '&cent;': '\u00A2',
    '&curren;': '\u00A4',
    // Common symbols
    '&percnt;': '%',
    '&ast;': '*',
    '&num;': '#',
    '&plus;': '+',
    '&minus;': '\u2212',
    '&equals;': '=',
    '&excl;': '!',
    '&quest;': '?',
    '&commat;': '@',
    '&lowbar;': '_',
    '&hyphen;': '\u2010',
    '&ndash;': '\u2013',
    '&mdash;': '\u2014',
    // Punctuation
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
    '&hellip;': '\u2026',
    '&bull;': '\u2022',
    '&middot;': '\u00B7',
    // Math
    '&times;': '\u00D7',
    '&divide;': '\u00F7',
    '&plusmn;': '\u00B1',
    '&frac12;': '\u00BD',
    '&frac14;': '\u00BC',
    '&frac34;': '\u00BE',
    // Other common
    '&copy;': '\u00A9',
    '&reg;': '\u00AE',
    '&trade;': '\u2122',
    '&deg;': '\u00B0',
  };

  return text.replace(/&[^;]+;/g, (entity) => {
    // Check named entities first
    if (entities[entity]) {
      return entities[entity];
    }
    // Handle decimal numeric entities: &#123;
    const decimalMatch = entity.match(/^&#(\d+);$/);
    if (decimalMatch) {
      const codePoint = parseInt(decimalMatch[1], 10);
      return String.fromCodePoint(codePoint);
    }
    // Handle hex numeric entities: &#x7B;
    const hexMatch = entity.match(/^&#x([0-9a-fA-F]+);$/);
    if (hexMatch) {
      const codePoint = parseInt(hexMatch[1], 16);
      return String.fromCodePoint(codePoint);
    }
    // Return original if not recognized
    return entity;
  });
}

/**
 * Escape markdown special characters to prevent rendering issues
 */
function escapeMarkdown(text: string): string {
  // Escape characters that have special meaning in markdown
  // Order matters: escape backslash first to avoid double-escaping
  return text.replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/_/g, '\\_').replace(/`/g, '\\`').replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/#/g, '\\#').replace(/\+/g, '\\+').replace(/-/g, '\\-').replace(/\./g, '\\.').replace(/!/g, '\\!').replace(/\|/g, '\\|');
}

/**
 * Search using Brave Search API (requires API key)
 */
async function searchBrave(query: string, apiKey: string, maxResults = 10): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodedQuery}&count=${maxResults}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Brave search failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      web?: {
        results?: Array<{
          title?: string;
          url?: string;
          description?: string;
        }>;
      };
    };

    return (data.web?.results || []).map((result) => ({
      title: result.title || '',
      url: result.url || '',
      snippet: result.description || '',
    }));
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Configuration for web search
 */
export interface WebSearchConfig {
  /** Brave Search API key (optional - uses DuckDuckGo if not provided) */
  braveApiKey?: string;
  /** Maximum results to return */
  maxResults?: number;
}

/**
 * Main web search function
 * Uses DuckDuckGo by default, Brave if API key is provided
 */
export async function webSearch(query: string, config: WebSearchConfig = {}): Promise<WebSearchResult> {
  const { braveApiKey, maxResults = 10 } = config;

  try {
    if (braveApiKey) {
      // Use Brave Search API if key is provided
      const results = await searchBrave(query, braveApiKey, maxResults);
      return {
        query,
        results,
        source: 'brave',
      };
    } else {
      // Default to DuckDuckGo (no API key required)
      const results = await searchDuckDuckGo(query, maxResults);
      return {
        query,
        results,
        source: 'duckduckgo',
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[WebSearch] Search failed:', errorMessage);
    return {
      query,
      results: [],
      source: braveApiKey ? 'brave' : 'duckduckgo',
      error: errorMessage,
    };
  }
}

/**
 * Format search results as markdown for AI consumption
 * Escapes special characters in titles and snippets to prevent rendering issues
 */
export function formatSearchResultsAsMarkdown(result: WebSearchResult): string {
  if (result.error) {
    return `## Search Error\n\nFailed to search for "${escapeMarkdown(result.query)}": ${escapeMarkdown(result.error)}`;
  }

  if (result.results.length === 0) {
    return `## No Results\n\nNo results found for "${escapeMarkdown(result.query)}"`;
  }

  let markdown = `## Search Results for "${escapeMarkdown(result.query)}"\n\n`;
  markdown += `*Source: ${result.source}*\n\n`;

  for (let i = 0; i < result.results.length; i++) {
    const r = result.results[i];
    // Escape title and snippet but keep URL as-is for clickability
    markdown += `### ${i + 1}\\. ${escapeMarkdown(r.title)}\n`;
    markdown += `**URL:** ${r.url}\n\n`;
    if (r.snippet) {
      markdown += `${escapeMarkdown(r.snippet)}\n\n`;
    }
    markdown += '---\n\n';
  }

  return markdown;
}
