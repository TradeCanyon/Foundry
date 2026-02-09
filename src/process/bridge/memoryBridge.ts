/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IMemorySearchResult, IUserProfileInfo } from '@/common/ipcBridge';
import { getDatabase } from '@process/database';
import type { MemoryType } from '@process/database/types';
import { storeMemory, recallMemories, learnPreference, getMemoryStats } from '@process/services/memoryService';
import { extractSessionMemories } from '@process/services/sessionSummaryService';

function toSearchResult(chunk: { id: string; content: string; type: string; workspace: string | null; tags: string[]; importance: number; createdAt: number }): IMemorySearchResult {
  return {
    id: chunk.id,
    content: chunk.content,
    type: chunk.type,
    workspace: chunk.workspace,
    tags: chunk.tags,
    importance: chunk.importance,
    createdAt: chunk.createdAt,
  };
}

export function initMemoryBridge(): void {
  // Search memories
  ipcBridge.memory.search.provider(async ({ query, workspace }) => {
    const memories = recallMemories({ query, workspace });
    return memories.map(toSearchResult);
  });

  // List memories by workspace/type
  ipcBridge.memory.list.provider(async ({ workspace, type, limit }) => {
    const db = getDatabase();
    const result = type ? db.getMemoriesByType(type, workspace, limit ?? 50) : db.getMemoriesByWorkspace(workspace ?? null, limit ?? 50);
    return (result.data ?? []).map(toSearchResult);
  });

  // Store a new memory
  ipcBridge.memory.store.provider(async ({ content, type, workspace, tags, importance }) => {
    try {
      const ids = storeMemory({
        content,
        type: type as MemoryType,
        workspace,
        tags,
        importance,
      });
      return { success: true, data: ids };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });

  // Delete a memory
  ipcBridge.memory.remove.provider(async ({ memoryId }) => {
    try {
      const db = getDatabase();
      db.deleteMemoryChunk(memoryId);
      return { success: true };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });

  // Delete all workspace memories
  ipcBridge.memory.removeWorkspace.provider(async ({ workspace }) => {
    try {
      const db = getDatabase();
      const result = db.deleteWorkspaceMemories(workspace);
      return { success: true, data: result.data ?? 0 };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });

  // Get user profile
  ipcBridge.memory.getProfile.provider(async () => {
    const db = getDatabase();
    const result = db.getUserProfile();
    return (result.data ?? []).map(
      (e): IUserProfileInfo => ({
        id: e.id,
        category: e.category,
        key: e.key,
        value: e.value,
        confidence: e.confidence,
        evidenceCount: e.evidenceCount,
      })
    );
  });

  // Set a profile entry
  ipcBridge.memory.setProfile.provider(async ({ category, key, value }) => {
    try {
      learnPreference(category, key, value);
      return { success: true };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });

  // Delete a profile entry
  ipcBridge.memory.removeProfile.provider(async ({ entryId }) => {
    try {
      const db = getDatabase();
      db.deleteUserProfileEntry(entryId);
      return { success: true };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });

  // Clear entire profile
  ipcBridge.memory.clearProfile.provider(async () => {
    try {
      const db = getDatabase();
      db.clearUserProfile();
      return { success: true };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });

  // Get memory stats
  ipcBridge.memory.getStats.provider(async ({ workspace }) => {
    const stats = getMemoryStats(workspace);
    return {
      totalMemories: stats.totalMemories,
      projectMemories: stats.projectMemories,
      globalMemories: stats.globalMemories,
      profileEntries: stats.profileEntries,
    };
  });

  // Trigger session memory extraction
  ipcBridge.memory.extractSession.provider(async ({ conversationId }) => {
    try {
      await extractSessionMemories(conversationId);
      return { success: true };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });
}
