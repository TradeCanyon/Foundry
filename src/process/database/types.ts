/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

// Reuse existing business type definitions
import type { TChatConversation, IConfigStorageRefer } from '@/common/storage';
import type { TMessage } from '@/common/chatLib';
import { z } from 'zod';

/**
 * ======================
 * Database specific types (new features)
 * ======================
 */

/**
 * User account (account system)
 */
export interface IUser {
  id: string;
  username: string;
  email?: string;
  password_hash: string;
  avatar_path?: string;
  jwt_secret?: string | null;
  created_at: number;
  updated_at: number;
  last_login?: number | null;
}

// Image metadata removed - images are stored in filesystem and referenced via message.resultDisplay

/**
 * ======================
 * Database query helper types
 * ======================
 */

/**
 * Database query result wrapper
 */
export interface IQueryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Paginated query result
 */
export interface IPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * ======================
 * Zod validation schemas (Decision D-004)
 * Single source of truth for valid DB values.
 * Add new types here — no DB migration needed.
 * ======================
 */

export const ConversationTypeSchema = z.enum(['gemini', 'acp', 'codex', 'image']);
export const ConversationStatusSchema = z.enum(['pending', 'running', 'finished']);
export const ConversationSourceSchema = z.enum(['foundry', 'telegram']);
export const MessagePositionSchema = z.enum(['left', 'right', 'center', 'pop']);
export const MessageStatusSchema = z.enum(['finish', 'pending', 'error', 'work']);

// Memory system schemas (Phase 5)
export const MemoryTypeSchema = z.enum(['session_summary', 'decision', 'lesson', 'preference', 'fact', 'correction']);
export const MemorySourceSchema = z.enum(['auto', 'user', 'agent']);
export type MemoryType = z.infer<typeof MemoryTypeSchema>;
export type MemorySource = z.infer<typeof MemorySourceSchema>;

export type ConversationType = z.infer<typeof ConversationTypeSchema>;
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;
export type ConversationSource = z.infer<typeof ConversationSourceSchema>;

/**
 * ======================
 * Database storage format (serialized format)
 * ======================
 */

/**
 * Conversation stored in database (serialized format)
 * Fields are typed as string — runtime validation via Zod schemas above.
 */
export interface IConversationRow {
  id: string;
  user_id: string;
  name: string;
  type: string;
  extra: string; // JSON string of extra data
  model?: string; // JSON string of TProviderWithModel (gemini/image types have this)
  status?: string;
  source?: string;
  created_at: number;
  updated_at: number;
}

/**
 * Message stored in database (serialized format)
 * Fields are typed as string — runtime validation via Zod schemas above.
 */
export interface IMessageRow {
  id: string;
  conversation_id: string;
  msg_id?: string; // Message source ID
  type: string; // TMessage['type']
  content: string; // JSON string of message content
  position?: string;
  status?: string;
  created_at: number;
}

/**
 * Config stored in database (key-value, for database version tracking)
 */
export interface IConfigRow {
  key: string;
  value: string; // JSON string
  updated_at: number;
}

/**
 * ======================
 * Type conversion functions
 * ======================
 */

/**
 * Convert TChatConversation to database row
 */
export function conversationToRow(conversation: TChatConversation, userId: string): IConversationRow {
  return {
    id: conversation.id,
    user_id: userId,
    name: conversation.name,
    type: conversation.type,
    extra: JSON.stringify(conversation.extra),
    model: 'model' in conversation ? JSON.stringify(conversation.model) : undefined,
    status: conversation.status,
    source: conversation.source,
    created_at: conversation.createTime,
    updated_at: conversation.modifyTime,
  };
}

/**
 * Convert database row to TChatConversation
 */
export function rowToConversation(row: IConversationRow): TChatConversation {
  const base = {
    id: row.id,
    name: row.name,
    desc: undefined as string | undefined,
    createTime: row.created_at,
    modifyTime: row.updated_at,
    status: row.status,
    source: row.source,
  };

  switch (row.type) {
    case 'gemini':
      return {
        ...base,
        type: 'gemini' as const,
        extra: JSON.parse(row.extra),
        model: row.model ? JSON.parse(row.model) : undefined,
      } as TChatConversation;

    case 'image':
      return {
        ...base,
        type: 'image' as const,
        extra: JSON.parse(row.extra),
        model: row.model ? JSON.parse(row.model) : undefined,
      } as TChatConversation;

    case 'acp':
      return {
        ...base,
        type: 'acp' as const,
        extra: JSON.parse(row.extra),
      } as TChatConversation;

    case 'codex':
    default:
      return {
        ...base,
        type: (row.type || 'codex') as 'codex',
        extra: JSON.parse(row.extra),
      } as TChatConversation;
  }
}

/**
 * Convert TMessage to database row
 */
export function messageToRow(message: TMessage): IMessageRow {
  return {
    id: message.id,
    conversation_id: message.conversation_id,
    msg_id: message.msg_id,
    type: message.type,
    content: JSON.stringify(message.content),
    position: message.position,
    status: message.status,
    created_at: message.createdAt || Date.now(),
  };
}

/**
 * Convert database row to TMessage
 */
export function rowToMessage(row: IMessageRow): TMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    msg_id: row.msg_id,
    type: row.type as TMessage['type'],
    content: JSON.parse(row.content),
    position: row.position,
    status: row.status,
    createdAt: row.created_at,
  } as TMessage;
}

/**
 * ======================
 * Export type aliases for convenience
 * ======================
 */

/**
 * ======================
 * Memory system types (Phase 5)
 * ======================
 */

/** Memory chunk stored in database */
export interface IMemoryChunkRow {
  id: string;
  workspace: string | null; // null = global, path = project-scoped
  conversation_id: string | null;
  type: string; // MemoryType
  source: string; // MemorySource
  content: string; // The actual memory text
  tags: string | null; // JSON array of tags
  importance: number; // 0-10 score
  access_count: number;
  last_accessed: number | null;
  created_at: number;
  updated_at: number;
}

/** Memory chunk business object */
export interface IMemoryChunk {
  id: string;
  workspace: string | null;
  conversationId: string | null;
  type: MemoryType;
  source: MemorySource;
  content: string;
  tags: string[];
  importance: number;
  accessCount: number;
  lastAccessed: number | null;
  createdAt: number;
  updatedAt: number;
}

/** User profile entry stored in database */
export interface IUserProfileRow {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number; // 0.0-1.0
  evidence_count: number;
  created_at: number;
  updated_at: number;
}

/** User profile entry business object */
export interface IUserProfileEntry {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  evidenceCount: number;
  createdAt: number;
  updatedAt: number;
}

/** Convert memory chunk row to business object */
export function rowToMemoryChunk(row: IMemoryChunkRow): IMemoryChunk {
  return {
    id: row.id,
    workspace: row.workspace,
    conversationId: row.conversation_id,
    type: row.type as MemoryType,
    source: row.source as MemorySource,
    content: row.content,
    tags: row.tags ? JSON.parse(row.tags) : [],
    importance: row.importance,
    accessCount: row.access_count,
    lastAccessed: row.last_accessed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Convert user profile row to business object */
export function rowToUserProfile(row: IUserProfileRow): IUserProfileEntry {
  return {
    id: row.id,
    category: row.category,
    key: row.key,
    value: row.value,
    confidence: row.confidence,
    evidenceCount: row.evidence_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type {
  // Reused business types
  TChatConversation,
  TMessage,
  IConfigStorageRefer,
};
