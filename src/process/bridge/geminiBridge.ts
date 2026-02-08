/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { getGeminiSubscriptionStatus } from '../services/geminiSubscription';

export function initGeminiBridge(): void {
  // Expose CLI subscription status to renderer. Frontend can use it to determine whether to show advanced models.
  ipcBridge.gemini.subscriptionStatus.provider(async ({ proxy }) => {
    try {
      const status = await getGeminiSubscriptionStatus(proxy);
      return { success: true, data: status };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
