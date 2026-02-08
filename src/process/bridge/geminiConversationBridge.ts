/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '../../common';
import { getDatabase } from '../database';
import { generateSuggestedReply } from '../services/suggestionService';
import type { GeminiAgentManager } from '../task/GeminiAgentManager';
import WorkerManage from '../WorkerManage';

// Gemini confirmMessage provider (for 'input.confirm.message' channel)
// Handles MCP tool confirmation including "always allow" options
export function initGeminiConversationBridge(): void {
  ipcBridge.geminiConversation.confirmMessage.provider(async ({ conversation_id, msg_id, confirmKey, callId }) => {
    const task = WorkerManage.getTaskById(conversation_id);
    if (!task) {
      return { success: false, msg: 'conversation not found' };
    }
    if (task.type !== 'gemini') {
      return { success: false, msg: 'only supported for gemini' };
    }

    // Call GeminiAgentManager.confirm() to send confirmation to worker
    void (task as GeminiAgentManager).confirm(msg_id, callId, confirmKey);
    return { success: true };
  });

  ipcBridge.geminiConversation.suggestReply.provider(async ({ conversation_id }) => {
    try {
      const db = getDatabase();
      const result = db.getConversationMessages(conversation_id, 0, 5, 'DESC');
      if (!result.data || result.data.length === 0) return '';

      const lastAiMsg = result.data.find((m) => m.position === 'left' && m.type === 'text');
      if (!lastAiMsg) return '';

      const textContent = typeof lastAiMsg.content === 'object' && 'content' in lastAiMsg.content ? (lastAiMsg.content as { content: string }).content : '';
      if (!textContent) return '';

      const convResult = db.getConversation(conversation_id);
      const modelName = convResult.data && 'model' in convResult.data ? convResult.data.model?.useModel : undefined;

      return await generateSuggestedReply(textContent, modelName);
    } catch {
      return '';
    }
  });
}
