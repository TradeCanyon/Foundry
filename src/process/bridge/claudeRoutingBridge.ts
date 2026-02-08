/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Claude Routing Bridge
 *
 * Exposes Claude routing service to the renderer process via IPC.
 * Enables subscription-first routing so users' Claude subscriptions "just work".
 */

import { ipcBridge } from '@/common';
import { detectClaudeCodeCli, getClaudeRoutingStatus, getCliInstallInstructions, getRoutingPreference, setRoutingPreference, shouldPromptCliInstall, clearCliCache, type ClaudeRoutingMode } from '../services/ClaudeRoutingService';

export function initClaudeRoutingBridge(): void {
  // Get current routing status
  ipcBridge.claudeRouting.getStatus.provider(async () => {
    try {
      const status = await getClaudeRoutingStatus();
      return { success: true, data: status };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Failed to get routing status',
      };
    }
  });

  // Set routing preference
  ipcBridge.claudeRouting.setPreference.provider(async ({ preference }: { preference: ClaudeRoutingMode }) => {
    try {
      await setRoutingPreference(preference);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Failed to set preference',
      };
    }
  });

  // Check if we should prompt user to install CLI
  ipcBridge.claudeRouting.shouldPromptInstall.provider(async () => {
    return shouldPromptCliInstall();
  });

  // Get CLI installation instructions
  ipcBridge.claudeRouting.getInstallInstructions.provider(async () => {
    return getCliInstallInstructions();
  });

  // Clear CLI detection cache
  ipcBridge.claudeRouting.clearCache.provider(async () => {
    clearCliCache();
  });

  // Re-detect CLI availability
  ipcBridge.claudeRouting.redetect.provider(async () => {
    try {
      clearCliCache();
      detectClaudeCodeCli(); // Force re-detection
      const status = await getClaudeRoutingStatus();
      return { success: true, data: status };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Failed to redetect CLI',
      };
    }
  });

  console.log('[ClaudeRoutingBridge] Initialized');
}
