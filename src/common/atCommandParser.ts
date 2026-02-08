/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared @ command parser for file references
 */

export interface AtCommandPart {
  type: 'text' | 'atPath';
  content: string;
}

/**
 * Check if a path looks like a Windows absolute path
 */
function isWindowsAbsolutePath(path: string): boolean {
  // Windows paths: C:\..., D:\..., etc.
  return /^[A-Za-z]:[\\/]/.test(path);
}

/**
 * Simple unescape function for @ paths
 *
 * Note: Windows paths with backslashes are preserved as-is
 */
function unescapeAtPath(rawPath: string): string {
  // Remove leading @ if present
  const path = rawPath.startsWith('@') ? rawPath.substring(1) : rawPath;

  // Preserve Windows absolute paths - don't unescape their backslashes
  if (isWindowsAbsolutePath(path)) {
    return path;
  }

  // For non-Windows paths, unescape backslash-escaped characters
  return path.replace(/\\(.)/g, '$1');
}

/**
 * Parses a query string to find all '@<path>' commands and text segments.
 * Handles \ escaped spaces within paths and quoted paths with spaces.
 *
 * @example
 * parseAllAtCommands('@file.txt hello @dir/path world')
 * // Returns: [
 * //   { type: 'atPath', content: 'file.txt' },
 * //   { type: 'text', content: 'hello' },
 * //   { type: 'atPath', content: 'dir/path' },
 * //   { type: 'text', content: 'world' }
 * // ]
 *
 * @example
 * parseAllAtCommands('@"C:\\Users\\My Documents\\file.txt" hello')
 * // Returns: [
 * //   { type: 'atPath', content: 'C:\\Users\\My Documents\\file.txt' },
 * //   { type: 'text', content: 'hello' }
 * // ]
 */
export function parseAllAtCommands(query: string): AtCommandPart[] {
  const parts: AtCommandPart[] = [];
  let currentIndex = 0;

  while (currentIndex < query.length) {
    let atIndex = -1;
    let nextSearchIndex = currentIndex;
    // Find next unescaped '@'
    while (nextSearchIndex < query.length) {
      if (query[nextSearchIndex] === '@' && (nextSearchIndex === 0 || query[nextSearchIndex - 1] !== '\\')) {
        atIndex = nextSearchIndex;
        break;
      }
      nextSearchIndex++;
    }

    if (atIndex === -1) {
      // No more @
      if (currentIndex < query.length) {
        parts.push({ type: 'text', content: query.substring(currentIndex) });
      }
      break;
    }

    // Add text before @
    if (atIndex > currentIndex) {
      parts.push({
        type: 'text',
        content: query.substring(currentIndex, atIndex),
      });
    }

    // Parse @path - check for quoted path first
    let pathEndIndex = atIndex + 1;
    let extractedPath: string;

    // Check if path is quoted (for paths with spaces)
    if (pathEndIndex < query.length && query[pathEndIndex] === '"') {
      // Find closing quote
      const closingQuoteIndex = query.indexOf('"', pathEndIndex + 1);
      if (closingQuoteIndex !== -1) {
        // Extract path without quotes
        extractedPath = query.substring(pathEndIndex + 1, closingQuoteIndex);
        pathEndIndex = closingQuoteIndex + 1;
      } else {
        // No closing quote, treat rest of string as path
        extractedPath = query.substring(pathEndIndex + 1);
        pathEndIndex = query.length;
      }
    } else {
      // Regular unquoted path parsing
      let inEscape = false;
      while (pathEndIndex < query.length) {
        const char = query[pathEndIndex];
        if (inEscape) {
          inEscape = false;
        } else if (char === '\\') {
          // Only set escape mode if next char is a special char that needs escaping
          // For Windows paths, backslash before letters/numbers is just a path separator
          const nextChar = pathEndIndex + 1 < query.length ? query[pathEndIndex + 1] : '';
          if (/[\s,;!?()[\]{}@]/.test(nextChar)) {
            inEscape = true;
          }
        } else if (/[,\s;!?()[\]{}]/.test(char)) {
          // Path ends at first whitespace or punctuation not escaped
          break;
        } else if (char === '.') {
          // For . we need to be more careful - only terminate if followed by whitespace or end of string
          // This allows file extensions like .txt, .js but terminates at sentence endings like "file.txt. Next sentence"
          const nextChar = pathEndIndex + 1 < query.length ? query[pathEndIndex + 1] : '';
          if (nextChar === '' || /\s/.test(nextChar)) {
            break;
          }
        }
        pathEndIndex++;
      }
      const rawAtPath = query.substring(atIndex, pathEndIndex);
      extractedPath = unescapeAtPath(rawAtPath);
    }

    parts.push({ type: 'atPath', content: extractedPath });
    currentIndex = pathEndIndex;
  }
  // Filter out empty text parts that might result from consecutive @paths or leading/trailing spaces
  return parts.filter((part) => !(part.type === 'text' && part.content.trim() === ''));
}

/**
 * Extract all @ file paths from a query string
 */
export function extractAtPaths(query: string): string[] {
  const parts = parseAllAtCommands(query);
  return parts.filter((part) => part.type === 'atPath' && part.content !== '').map((part) => part.content);
}

/**
 * Check if a query contains any @ file references
 */
export function hasAtReferences(query: string): boolean {
  return extractAtPaths(query).length > 0;
}

/**
 * Reconstruct query from parts, optionally replacing @ paths
 */
export function reconstructQuery(parts: AtCommandPart[], pathReplacer?: (path: string) => string): string {
  return parts
    .map((part) => {
      if (part.type === 'text') {
        return part.content;
      } else {
        // atPath
        if (pathReplacer) {
          return pathReplacer(part.content);
        }
        return '@' + part.content;
      }
    })
    .join('');
}
