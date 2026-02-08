/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Built-in Web Fetch Service for Foundry
 * Fetches URLs and converts HTML to readable text
 * Works for all agents without requiring Gemini OAuth
 */

import { convert } from 'html-to-text';

export interface WebFetchResult {
  url: string;
  title: string;
  content: string;
  contentType: string;
  statusCode: number;
  error?: string;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 15000;
const MAX_CONTENT_LENGTH = 100000;

/**
 * Configuration for web fetch
 */
export interface WebFetchConfig {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Maximum content length to return */
  maxLength?: number;
  /** Whether to convert HTML to plain text */
  convertToText?: boolean;
}

/**
 * Extract page title from HTML
 */
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : '';
}

/**
 * Convert HTML to readable plain text
 */
function htmlToText(html: string, maxLength: number): string {
  try {
    const text = convert(html, {
      wordwrap: false,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' },
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'nav', format: 'skip' },
        { selector: 'footer', format: 'skip' },
        { selector: 'header', format: 'skip' },
      ],
    });

    // Normalize whitespace
    const normalized = text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    return normalized.substring(0, maxLength);
  } catch (error) {
    // If conversion fails, fall back to basic stripping
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, maxLength);
  }
}

/**
 * Transform GitHub blob URLs to raw URLs for direct content access
 */
function transformGitHubUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    if ((parsedUrl.hostname === 'github.com' || parsedUrl.hostname === 'www.github.com') && parsedUrl.pathname.includes('/blob/')) {
      return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Fetch a URL and return its content
 */
export async function webFetch(url: string, config: WebFetchConfig = {}): Promise<WebFetchResult> {
  const { timeout = FETCH_TIMEOUT_MS, maxLength = MAX_CONTENT_LENGTH, convertToText = true } = config;

  // Transform special URLs (e.g., GitHub blob to raw)
  const fetchUrl = transformGitHubUrl(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type') || 'text/html';
    const statusCode = response.status;

    if (!response.ok) {
      return {
        url,
        title: '',
        content: '',
        contentType,
        statusCode,
        error: `HTTP ${statusCode}: ${response.statusText}`,
      };
    }

    const rawContent = await response.text();
    const title = extractTitle(rawContent);

    let content: string;
    if (convertToText && contentType.includes('text/html')) {
      content = htmlToText(rawContent, maxLength);
    } else {
      content = rawContent.substring(0, maxLength);
    }

    return {
      url,
      title,
      content,
      contentType,
      statusCode,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle specific error types
    if (controller.signal.aborted) {
      return {
        url,
        title: '',
        content: '',
        contentType: '',
        statusCode: 0,
        error: `Request timed out after ${timeout}ms`,
      };
    }

    return {
      url,
      title: '',
      content: '',
      contentType: '',
      statusCode: 0,
      error: errorMessage,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Format fetch result as markdown for AI consumption
 */
export function formatFetchResultAsMarkdown(result: WebFetchResult): string {
  if (result.error) {
    return `## Fetch Error\n\nFailed to fetch "${result.url}": ${result.error}`;
  }

  let markdown = `## Content from ${result.url}\n\n`;

  if (result.title) {
    markdown += `**Title:** ${result.title}\n\n`;
  }

  markdown += '---\n\n';
  markdown += result.content;
  markdown += '\n\n---\n';

  return markdown;
}
