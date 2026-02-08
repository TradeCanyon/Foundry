/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Built-in MCP Service
 *
 * Manages Foundry's built-in MCP tools (web search, web fetch).
 * Auto-registers these tools with CLI agents on startup.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

const MCP_SERVER_NAME = 'foundry-web-tools';

/**
 * Get the path to the MCP web tools server script
 */
function getMcpServerPath(): string {
  // In development, use the TypeScript source via ts-node
  // In production, use the compiled JavaScript
  const srcPath = path.join(__dirname, '../../common/tools/McpWebToolsServer.ts');
  const distPath = path.join(__dirname, '../../common/tools/McpWebToolsServer.js');

  // Check if we're in development (source exists) or production
  if (fs.existsSync(srcPath)) {
    return srcPath;
  }

  return distPath;
}

/**
 * Check if Claude Code CLI is available
 */
async function isClaudeCliAvailable(): Promise<boolean> {
  try {
    await execFileAsync('claude', ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the web tools MCP server is already registered
 */
async function isMcpServerRegistered(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('claude', ['mcp', 'list'], {
      timeout: 5000,
      env: { ...process.env, NODE_OPTIONS: '' },
    });

    return stdout.includes(MCP_SERVER_NAME);
  } catch {
    return false;
  }
}

/**
 * Register the built-in web tools MCP server with Claude Code
 */
async function registerMcpServer(): Promise<{ success: boolean; error?: string }> {
  try {
    const serverPath = getMcpServerPath();

    // Determine the command based on file type
    let mcpCommand: string;
    let mcpArgs: string[];

    if (serverPath.endsWith('.ts')) {
      // Development: use npx ts-node
      mcpCommand = 'npx';
      mcpArgs = ['ts-node', serverPath];
    } else {
      // Production: use node directly
      mcpCommand = 'node';
      mcpArgs = [serverPath];
    }

    // Build the claude mcp add command arguments
    // Format: claude mcp add -s user <name> <command> -- [args...]
    const claudeArgs = ['mcp', 'add', '-s', 'user', MCP_SERVER_NAME, mcpCommand, '--', ...mcpArgs];

    console.log(`[BuiltinMcpService] Registering MCP server: claude ${claudeArgs.join(' ')}`);

    await execFileAsync('claude', claudeArgs, {
      timeout: 10000,
      env: { ...process.env, NODE_OPTIONS: '' },
    });

    console.log(`[BuiltinMcpService] Successfully registered ${MCP_SERVER_NAME}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[BuiltinMcpService] Failed to register MCP server:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Remove the built-in MCP server from Claude Code
 */
async function unregisterMcpServer(): Promise<{ success: boolean; error?: string }> {
  try {
    await execFileAsync('claude', ['mcp', 'remove', '-s', 'user', MCP_SERVER_NAME], {
      timeout: 5000,
      env: { ...process.env, NODE_OPTIONS: '' },
    });

    console.log(`[BuiltinMcpService] Unregistered ${MCP_SERVER_NAME}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Not found is OK - means it's already unregistered
    if (errorMessage.includes('not found')) {
      return { success: true };
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * Initialize built-in MCP tools on startup
 * Call this when Foundry starts
 */
export async function initBuiltinMcpTools(): Promise<void> {
  console.log('[BuiltinMcpService] Initializing built-in MCP tools...');

  // Check if Claude CLI is available
  const claudeAvailable = await isClaudeCliAvailable();
  if (!claudeAvailable) {
    console.log('[BuiltinMcpService] Claude CLI not available, skipping MCP registration');
    return;
  }

  // Check if already registered
  const isRegistered = await isMcpServerRegistered();
  if (isRegistered) {
    console.log(`[BuiltinMcpService] ${MCP_SERVER_NAME} already registered`);
    return;
  }

  // Register the MCP server
  const result = await registerMcpServer();
  if (!result.success) {
    console.warn(`[BuiltinMcpService] Failed to register built-in MCP tools: ${result.error}`);
  }
}

/**
 * Cleanup built-in MCP tools on shutdown
 * Optional - call this when Foundry closes
 */
export async function cleanupBuiltinMcpTools(): Promise<void> {
  // Optionally unregister on cleanup
  // For now, we leave it registered so it persists
  console.log('[BuiltinMcpService] Cleanup called (keeping MCP server registered)');
}

export { registerMcpServer, unregisterMcpServer, isMcpServerRegistered, isClaudeCliAvailable };
