/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * MCP Server for Web Tools
 *
 * This is a stdio-based MCP server that provides web search and fetch tools.
 * It can be registered with Claude Code to provide these capabilities.
 *
 * Usage:
 *   npx ts-node src/common/tools/McpWebToolsServer.ts
 *   OR
 *   node dist/common/tools/McpWebToolsServer.js
 *
 * The server communicates via stdin/stdout using JSON-RPC 2.0 protocol.
 */

import { webSearch, type WebSearchConfig } from './webSearch';
import { webFetch, type WebFetchConfig } from './webFetch';
import * as readline from 'readline';

// MCP Protocol Types
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Tool definitions
const TOOLS: McpTool[] = [
  {
    name: 'web_search',
    description: 'Search the web using DuckDuckGo. Returns a list of search results with titles, URLs, and snippets. Use this to find information on the internet.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch the content of a web page and convert it to readable text. Use this to read articles, documentation, or any web page.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch',
        },
      },
      required: ['url'],
    },
  },
];

// Handle tool calls
async function handleToolCall(toolName: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  switch (toolName) {
    case 'web_search': {
      const query = args.query as string;
      const maxResults = (args.max_results as number) || 10;

      const config: WebSearchConfig = { maxResults };
      const result = await webSearch(query, config);

      if (result.error) {
        return {
          content: [{ type: 'text', text: `Search error: ${result.error}` }],
        };
      }

      let text = `Search results for "${query}" (source: ${result.source}):\n\n`;
      result.results.forEach((r, i) => {
        text += `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}\n\n`;
      });

      return { content: [{ type: 'text', text }] };
    }

    case 'web_fetch': {
      const url = args.url as string;

      const config: WebFetchConfig = { convertToText: true };
      const result = await webFetch(url, config);

      if (result.error) {
        return {
          content: [{ type: 'text', text: `Fetch error: ${result.error}` }],
        };
      }

      let text = `Content from ${url}`;
      if (result.title) {
        text += ` (${result.title})`;
      }
      text += `:\n\n${result.content}`;

      return { content: [{ type: 'text', text }] };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Handle JSON-RPC requests
async function handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'foundry-web-tools',
              version: '1.0.0',
            },
          },
        };

      case 'notifications/initialized':
        // No response needed for notifications
        return { jsonrpc: '2.0', id, result: {} };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: { tools: TOOLS },
        };

      case 'tools/call': {
        const toolName = params?.name as string;
        const toolArgs = (params?.arguments as Record<string, unknown>) || {};

        const result = await handleToolCall(toolName, toolArgs);
        return {
          jsonrpc: '2.0',
          id,
          result,
        };
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

// Main server loop
function startServer(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // Log to stderr so it doesn't interfere with JSON-RPC on stdout
  const log = (msg: string) => process.stderr.write(`[foundry-web-tools] ${msg}\n`);

  log('MCP Web Tools Server starting...');

  rl.on('line', async (line) => {
    try {
      const request = JSON.parse(line) as JsonRpcRequest;
      log(`Received: ${request.method}`);

      const response = await handleRequest(request);

      // Only send response if there's an id (not a notification)
      if (request.id !== undefined) {
        console.log(JSON.stringify(response));
      }
    } catch (error) {
      log(`Error: ${error instanceof Error ? error.message : String(error)}`);
      const errorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
        },
      };
      console.log(JSON.stringify(errorResponse));
    }
  });

  rl.on('close', () => {
    log('Server shutting down');
    process.exit(0);
  });
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export { startServer, TOOLS };
