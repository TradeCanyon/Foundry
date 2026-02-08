/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Claude Routing Service
 *
 * Manages routing preference between Claude Code CLI (subscription) and
 * direct Anthropic API (credits). Implements "subscription-first" routing
 * to minimize user confusion about billing.
 *
 * Billing Reality:
 * - Claude.ai subscription (Max/Pro) → Used by Claude Code CLI
 * - Anthropic API credits → Separate prepaid system at console.anthropic.com
 *
 * This service defaults to CLI when available, so users' subscriptions "just work".
 */

import { execFileSync } from 'child_process';
import { ConfigStorage } from '@/common/storage';

export type ClaudeRoutingMode = 'cli' | 'api' | 'auto';

export interface ClaudeRoutingStatus {
  /** Whether Claude Code CLI is installed and available */
  cliAvailable: boolean;
  /** Whether Anthropic API key is configured */
  apiKeyConfigured: boolean;
  /** Current routing preference */
  preference: ClaudeRoutingMode;
  /** Which route will actually be used based on availability */
  effectiveRoute: 'cli' | 'api' | 'none';
  /** Human-readable status message */
  statusMessage: string;
}

// Cache CLI detection result (doesn't change during session)
let cliAvailableCache: boolean | null = null;

/**
 * Detect if Claude Code CLI is installed
 * Uses execFileSync with explicit command to avoid shell injection
 */
export function detectClaudeCodeCli(): boolean {
  if (cliAvailableCache !== null) {
    return cliAvailableCache;
  }

  try {
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      // On Windows, use 'where' command
      execFileSync('where', ['claude'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });
    } else {
      // On Unix, use 'which' command
      execFileSync('which', ['claude'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });
    }

    cliAvailableCache = true;
    console.log('[ClaudeRoutingService] Claude Code CLI detected');
    return true;
  } catch {
    cliAvailableCache = false;
    console.log('[ClaudeRoutingService] Claude Code CLI not found');
    return false;
  }
}

/**
 * Check if Anthropic API key is configured
 */
export async function isAnthropicApiConfigured(): Promise<boolean> {
  try {
    // Check environment variable
    if (process.env.ANTHROPIC_API_KEY) {
      return true;
    }

    // Check stored model configs for Anthropic/Claude platforms
    const modelConfigs = await ConfigStorage.get('model.config');
    if (modelConfigs && Array.isArray(modelConfigs)) {
      const hasAnthropicConfig = modelConfigs.some((config: any) => config.api_key && (config.platform?.toLowerCase().includes('anthropic') || config.platform?.toLowerCase().includes('claude') || config.api_key.startsWith('sk-ant-')));
      if (hasAnthropicConfig) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get current routing preference
 * Default: 'auto' (prefer CLI when available)
 */
export async function getRoutingPreference(): Promise<ClaudeRoutingMode> {
  try {
    const pref = await ConfigStorage.get('claude.routingPreference');
    return (pref as ClaudeRoutingMode) || 'auto';
  } catch {
    return 'auto';
  }
}

/**
 * Set routing preference
 */
export async function setRoutingPreference(preference: ClaudeRoutingMode): Promise<void> {
  await ConfigStorage.set('claude.routingPreference', preference);
  console.log(`[ClaudeRoutingService] Routing preference set to: ${preference}`);
}

/**
 * Get complete routing status
 */
export async function getClaudeRoutingStatus(): Promise<ClaudeRoutingStatus> {
  const cliAvailable = detectClaudeCodeCli();
  const apiKeyConfigured = await isAnthropicApiConfigured();
  const preference = await getRoutingPreference();

  // Determine effective route
  let effectiveRoute: 'cli' | 'api' | 'none';
  let statusMessage: string;

  if (preference === 'cli') {
    // User explicitly wants CLI
    if (cliAvailable) {
      effectiveRoute = 'cli';
      statusMessage = 'Using Claude Code CLI (subscription)';
    } else {
      effectiveRoute = 'none';
      statusMessage = 'Claude Code CLI not installed';
    }
  } else if (preference === 'api') {
    // User explicitly wants API
    if (apiKeyConfigured) {
      effectiveRoute = 'api';
      statusMessage = 'Using Anthropic API (credits)';
    } else {
      effectiveRoute = 'none';
      statusMessage = 'Anthropic API key not configured';
    }
  } else {
    // Auto mode: prefer CLI, fall back to API
    if (cliAvailable) {
      effectiveRoute = 'cli';
      statusMessage = 'Using Claude Code CLI (subscription)';
    } else if (apiKeyConfigured) {
      effectiveRoute = 'api';
      statusMessage = 'Using Anthropic API (credits) - Install Claude Code to use subscription';
    } else {
      effectiveRoute = 'none';
      statusMessage = 'No Claude access configured';
    }
  }

  return {
    cliAvailable,
    apiKeyConfigured,
    preference,
    effectiveRoute,
    statusMessage,
  };
}

/**
 * Should we prompt the user to install Claude Code CLI?
 * Returns true if: API is configured, CLI is not, and preference is auto
 */
export async function shouldPromptCliInstall(): Promise<boolean> {
  const status = await getClaudeRoutingStatus();
  return !status.cliAvailable && status.apiKeyConfigured && status.preference === 'auto';
}

/**
 * Get installation instructions for Claude Code CLI
 */
export function getCliInstallInstructions(): { command: string; url: string } {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isMac) {
    return {
      command: 'brew install anthropic/tap/claude-code',
      url: 'https://docs.anthropic.com/en/docs/claude-code',
    };
  } else if (isWindows) {
    return {
      command: 'winget install Anthropic.ClaudeCode',
      url: 'https://docs.anthropic.com/en/docs/claude-code',
    };
  } else {
    return {
      command: 'npm install -g @anthropic-ai/claude-code',
      url: 'https://docs.anthropic.com/en/docs/claude-code',
    };
  }
}

/**
 * Clear cached CLI detection (useful after installation)
 */
export function clearCliCache(): void {
  cliAvailableCache = null;
}
