/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * MemoryService — Persistent memory for Foundry.
 *
 * Provides:
 * - `storeMemory()` — chunk, sanitize, store with credential filtering
 * - `recallMemories()` — hybrid retrieval: FTS5 search + recency + importance
 * - `buildMemoryContext()` — format memories for agent injection
 * - `storeSessionSummary()` — post-conversation summary storage
 * - User profile learning and retrieval
 *
 * Architecture:
 * - FTS5 for keyword/BM25 search (built into better-sqlite3)
 * - Recency + importance weighting for retrieval ranking
 * - Credential filtering before any storage
 * - Workspace-scoped (project) + global memory tiers
 */

import { getDatabase } from '@process/database';
import type { IMemoryChunk, IUserProfileEntry, MemoryType, MemorySource } from '@process/database/types';
import { truncateToTokenBudget, allocateBudget, estimateTokens } from './contextBudget';

// ============================================================
// Credential filtering — NEVER store secrets in memory
// ============================================================

const CREDENTIAL_PATTERNS = [
  // API keys (generic patterns)
  /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[\w\-./]{20,}['"]?/gi,
  /(?:secret[_-]?key|secretkey)\s*[:=]\s*['"]?[\w\-./]{20,}['"]?/gi,
  /(?:access[_-]?token|accesstoken)\s*[:=]\s*['"]?[\w\-./]{20,}['"]?/gi,
  // Specific provider patterns
  /sk-[a-zA-Z0-9]{20,}/g, // OpenAI
  /AIza[a-zA-Z0-9\-_]{35}/g, // Google
  /sk-ant-[a-zA-Z0-9\-_]{20,}/g, // Anthropic
  /ghp_[a-zA-Z0-9]{36}/g, // GitHub
  /gho_[a-zA-Z0-9]{36}/g, // GitHub OAuth
  /xoxb-[a-zA-Z0-9-]+/g, // Slack bot
  /xoxp-[a-zA-Z0-9-]+/g, // Slack user
  // Passwords and bearer tokens
  /(?:password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/gi,
  /Bearer\s+[\w\-./=+]{20,}/g,
  // Connection strings
  /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+/gi,
  // Private keys
  /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
  // AWS
  /AKIA[A-Z0-9]{16}/g,
  // JWT tokens
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
];

/**
 * Remove credentials and secrets from text before memory storage.
 */
export function sanitizeForMemory(text: string): string {
  let sanitized = text;
  for (const pattern of CREDENTIAL_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

// ============================================================
// Memory chunking
// ============================================================

const MAX_CHUNK_CHARS = 2048; // ~512 tokens at 4 chars/token

/**
 * Split text into chunks at paragraph boundaries, respecting max size.
 */
export function chunkText(text: string, maxChars = MAX_CHUNK_CHARS): string[] {
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars) {
      if (current) chunks.push(current.trim());
      // If a single paragraph is too long, split at sentence boundaries
      if (para.length > maxChars) {
        const sentences = para.split(/(?<=[.!?])\s+/);
        current = '';
        for (const sentence of sentences) {
          if (current.length + sentence.length + 1 > maxChars) {
            if (current) chunks.push(current.trim());
            current = sentence;
          } else {
            current = current ? `${current} ${sentence}` : sentence;
          }
        }
      } else {
        current = para;
      }
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ============================================================
// Core memory operations
// ============================================================

/**
 * Store a memory, chunking if necessary. Returns IDs of stored chunks.
 */
export function storeMemory(opts: { content: string; type: MemoryType; workspace?: string | null; conversationId?: string | null; source?: MemorySource; tags?: string[]; importance?: number }): string[] {
  const db = getDatabase();
  const sanitized = sanitizeForMemory(opts.content);

  if (!sanitized.trim()) return [];

  const chunks = chunkText(sanitized);
  const ids: string[] = [];

  for (const chunk of chunks) {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = db.insertMemoryChunk({
      id,
      workspace: opts.workspace,
      conversationId: opts.conversationId,
      type: opts.type,
      source: opts.source ?? 'auto',
      content: chunk,
      tags: opts.tags,
      importance: opts.importance ?? 5,
    });

    if (result.success) ids.push(id);
  }

  return ids;
}

/**
 * Store a session summary after conversation ends.
 */
export function storeSessionSummary(opts: { summary: string; workspace?: string | null; conversationId?: string | null; tags?: string[] }): string[] {
  return storeMemory({
    content: opts.summary,
    type: 'session_summary',
    workspace: opts.workspace,
    conversationId: opts.conversationId,
    source: 'auto',
    tags: opts.tags ?? ['session-summary'],
    importance: 6,
  });
}

/**
 * Store a user correction (highest importance — drives personality learning).
 */
export function storeCorrection(opts: { content: string; workspace?: string | null; conversationId?: string | null }): string[] {
  return storeMemory({
    content: opts.content,
    type: 'correction',
    workspace: opts.workspace,
    conversationId: opts.conversationId,
    source: 'user',
    tags: ['correction', 'preference'],
    importance: 9,
  });
}

// ============================================================
// Memory retrieval
// ============================================================

export interface RecallOptions {
  query?: string;
  workspace?: string | null;
  types?: MemoryType[];
  limit?: number;
}

/**
 * Recall relevant memories using hybrid approach:
 * 1. FTS5/BM25 search (if query provided)
 * 2. Recency + importance weighted retrieval (always)
 * 3. Deduplicate and merge results
 */
export function recallMemories(opts: RecallOptions): IMemoryChunk[] {
  const db = getDatabase();
  const limit = opts.limit ?? 20;
  const seen = new Set<string>();
  const results: IMemoryChunk[] = [];

  const addUnique = (chunks: IMemoryChunk[]) => {
    for (const chunk of chunks) {
      if (!seen.has(chunk.id)) {
        seen.add(chunk.id);
        results.push(chunk);
      }
    }
  };

  // 1. FTS5 search (if query provided) — weighted 70%
  if (opts.query?.trim()) {
    // Escape FTS5 special characters
    const safeQuery = opts.query.replace(/['"*()]/g, ' ').trim();
    if (safeQuery) {
      const searchResult = db.searchMemories(safeQuery, opts.workspace, Math.ceil(limit * 0.7));
      if (searchResult.success && searchResult.data) {
        addUnique(searchResult.data);
      }
    }
  }

  // 2. Recent + important memories — fills remaining slots
  const remaining = limit - results.length;
  if (remaining > 0) {
    const recentResult = db.getMemoriesByWorkspace(opts.workspace ?? null, remaining);
    if (recentResult.success && recentResult.data) {
      addUnique(recentResult.data);
    }
  }

  // 3. Filter by type if specified
  const filtered = opts.types ? results.filter((m) => opts.types!.includes(m.type)) : results;

  // 4. Mark accessed
  for (const memory of filtered) {
    db.touchMemory(memory.id);
  }

  return filtered.slice(0, limit);
}

// ============================================================
// Context building for agent injection
// ============================================================

/**
 * Build memory context string for agent injection.
 * Retrieves relevant memories and formats them within the budget.
 */
export function buildMemoryContext(opts: { query?: string; workspace?: string | null; totalTokens?: number }): string | null {
  const budget = allocateBudget({ totalTokens: opts.totalTokens });
  const db = getDatabase();

  // Collect all memory content
  const sections: string[] = [];

  // A. User profile (always loaded, top priority)
  const profileResult = db.getUserProfile();
  if (profileResult.success && profileResult.data && profileResult.data.length > 0) {
    const profileLines = profileResult.data
      .filter((e) => e.confidence >= 0.3) // Only include reasonably confident entries
      .map((e) => `- ${e.category}/${e.key}: ${e.value}`);

    if (profileLines.length > 0) {
      sections.push(`[User Profile]\n${profileLines.join('\n')}`);
    }
  }

  // B. Relevant memories (search + recency)
  const memories = recallMemories({
    query: opts.query,
    workspace: opts.workspace,
    limit: 15,
  });

  if (memories.length > 0) {
    const memoryLines = memories.map((m) => {
      const age = timeAgo(m.createdAt);
      const typeLabel = m.type.replace(/_/g, ' ');
      return `[${typeLabel} — ${age}]\n${m.content}`;
    });
    sections.push(`[Relevant Memories]\n${memoryLines.join('\n\n')}`);
  }

  if (sections.length === 0) return null;

  const fullContext = sections.join('\n\n');
  return truncateToTokenBudget(fullContext, budget.memory);
}

// ============================================================
// User profile learning
// ============================================================

/**
 * Learn a user preference. Confidence increases with repeated observations.
 */
export function learnPreference(category: string, key: string, value: string, confidence?: number): void {
  const db = getDatabase();
  const id = `prof_${category}_${key}`.replace(/[^a-zA-Z0-9_]/g, '_');
  db.upsertUserProfile({ id, category, key, value, confidence });
}

/**
 * Get a specific user profile value.
 */
export function getProfileValue(category: string, key: string): string | null {
  const db = getDatabase();
  const result = db.getUserProfileByCategory(category);
  if (!result.success || !result.data) return null;
  const entry = result.data.find((e) => e.key === key);
  return entry?.value ?? null;
}

/**
 * Get all profile entries formatted for display.
 */
export function getFormattedProfile(): { category: string; entries: IUserProfileEntry[] }[] {
  const db = getDatabase();
  const result = db.getUserProfile();
  if (!result.success || !result.data) return [];

  const grouped = new Map<string, IUserProfileEntry[]>();
  for (const entry of result.data) {
    if (!grouped.has(entry.category)) grouped.set(entry.category, []);
    grouped.get(entry.category)!.push(entry);
  }

  return Array.from(grouped.entries()).map(([category, entries]) => ({ category, entries }));
}

// ============================================================
// Memory stats
// ============================================================

export interface MemoryStats {
  totalMemories: number;
  projectMemories: number;
  globalMemories: number;
  profileEntries: number;
  oldestMemory: number | null;
  newestMemory: number | null;
}

export function getMemoryStats(workspace?: string | null): MemoryStats {
  const db = getDatabase();

  const totalResult = db.getMemoryCount();
  const projectResult = workspace ? db.getMemoryCount(workspace) : { data: 0 };
  const globalResult = db.getMemoryCount(null);
  const profileResult = db.getUserProfile();

  return {
    totalMemories: totalResult.data ?? 0,
    projectMemories: projectResult.data ?? 0,
    globalMemories: globalResult.data ?? 0,
    profileEntries: profileResult.data?.length ?? 0,
    oldestMemory: null, // Could query min(created_at) but not critical
    newestMemory: null,
  };
}

// ============================================================
// Helpers
// ============================================================

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
