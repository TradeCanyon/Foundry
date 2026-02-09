/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * emberBridge — IPC bridge for Ember assistant.
 *
 * Registers providers for:
 * - ember.send: Send a message to Ember
 * - ember.get-activity: Get recent activity log
 * - ember.get-config: Get Ember configuration
 * - ember.set-config: Update Ember configuration
 * - ember.reset-conversation: Clear Ember's conversation history
 */

import { ember } from '@/common/ipcBridge';
import { RateLimiter } from '@/channels/utils/rateLimiter';
import { emberService } from '@process/services/emberService';

const emberRateLimiter = new RateLimiter({ maxAttempts: 30, windowMs: 60_000 });

export function initEmberBridge(): void {
  ember.send.provider(async ({ input, workspace, conversationId, source }) => {
    const { allowed, retryAfterMs } = emberRateLimiter.check('ember.send');
    if (!allowed) {
      return { text: `Rate limited. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`, intent: 'error' as const };
    }

    // Input length limit to prevent memory/DB abuse
    const safeInput = typeof input === 'string' ? input.substring(0, 10000) : '';
    return emberService.processMessage(safeInput, {
      workspace,
      conversationId,
      source: (source as 'ui' | 'channel' | 'cron') || 'ui',
    });
  });

  ember.getActivity.provider(async ({ limit }) => {
    return emberService.getRecentActivity(limit ?? 20);
  });

  ember.getConfig.provider(async () => {
    return emberService.getConfig();
  });

  ember.setConfig.provider(async (updates) => {
    emberService.setConfig({
      ...updates,
      personality: updates.personality as any,
      autonomy: updates.autonomy as any,
    });
  });

  ember.resetConversation.provider(async () => {
    emberService.resetConversation();
  });
}
