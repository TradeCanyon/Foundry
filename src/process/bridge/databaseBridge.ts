/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '../../common';
import { getDatabase } from '@process/database';
import { ProcessChat } from '../initStorage';
import type { TChatConversation } from '@/common/storage';
import { migrateConversationToDatabase } from './migrationUtils';

export function initDatabaseBridge(): void {
  // Delete messages after a specific timestamp (for message editing)
  ipcBridge.database.deleteMessagesAfter.provider(({ conversation_id, afterTimestamp }) => {
    try {
      const db = getDatabase();
      const result = db.deleteMessagesAfter(conversation_id, afterTimestamp);
      return Promise.resolve({ success: true, data: { deletedCount: result.data || 0 } });
    } catch (error) {
      console.error('[DatabaseBridge] Error deleting messages:', error);
      return Promise.resolve({ success: false, msg: error instanceof Error ? error.message : 'Failed to delete messages' });
    }
  });

  // Update message content (for message editing)
  ipcBridge.database.updateMessageContent.provider(({ messageId, content }) => {
    try {
      const db = getDatabase();
      console.log('[DatabaseBridge] updateMessageContent called with messageId:', messageId, 'content length:', content.length);

      const result = db.updateMessageContent(messageId, content);
      console.log('[DatabaseBridge] Update result - success:', result.success, 'changes:', result.data, 'error:', result.error);

      if (!result.success) {
        return Promise.resolve({ success: false, msg: result.error || 'Database update failed' });
      }
      if (!result.data) {
        return Promise.resolve({ success: false, msg: `No message found with ID: ${messageId}` });
      }
      return Promise.resolve({ success: true });
    } catch (error) {
      console.error('[DatabaseBridge] Error updating message:', error);
      return Promise.resolve({ success: false, msg: error instanceof Error ? error.message : 'Failed to update message' });
    }
  });

  // Get conversation messages from database
  ipcBridge.database.getConversationMessages.provider(({ conversation_id, page = 0, pageSize = 10000 }) => {
    try {
      const db = getDatabase();
      const result = db.getConversationMessages(conversation_id, page, pageSize);
      return Promise.resolve(result.data || []);
    } catch (error) {
      console.error('[DatabaseBridge] Error getting conversation messages:', error);
      return Promise.resolve([]);
    }
  });

  // Get user conversations from database with lazy migration from file storage
  ipcBridge.database.getUserConversations.provider(async ({ page = 0, pageSize = 10000 }) => {
    try {
      const db = getDatabase();
      const result = db.getUserConversations(undefined, page, pageSize);
      const dbConversations = result.data || [];

      // Try to get conversations from file storage
      let fileConversations: TChatConversation[] = [];
      try {
        fileConversations = (await ProcessChat.get('chat.history')) || [];
      } catch (error) {
        console.warn('[DatabaseBridge] No file-based conversations found:', error);
      }

      // Use database conversations as the primary source while backfilling missing ones from file storage
      // Build a map for fast lookup to avoid duplicates when merging
      const dbConversationMap = new Map(dbConversations.map((conv) => [conv.id, conv] as const));

      // Filter out conversations that already exist in database
      const fileOnlyConversations = fileConversations.filter((conv) => !dbConversationMap.has(conv.id));

      // If there are conversations that only exist in file storage, migrate them in background
      if (fileOnlyConversations.length > 0) {
        void Promise.all(fileOnlyConversations.map((conv) => migrateConversationToDatabase(conv)));
      }

      // Combine database conversations (source of truth) with any remaining file-only conversations
      const allConversations = [...dbConversations, ...fileOnlyConversations];
      // Re-sort by modifyTime (or createTime as fallback) to maintain correct order
      allConversations.sort((a, b) => (b.modifyTime || b.createTime || 0) - (a.modifyTime || a.createTime || 0));
      return allConversations;
    } catch (error) {
      console.error('[DatabaseBridge] Error getting user conversations:', error);
      return [];
    }
  });
}
