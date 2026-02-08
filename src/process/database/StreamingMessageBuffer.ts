/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TMessage } from '@/common/chatLib';
import { getDatabase } from './index';

/**
 * Streaming Message Buffer Manager
 *
 * Purpose: Optimize database write performance for streaming messages
 *
 * Core strategy:
 * - Delayed updates: Instead of writing DB for each chunk, batch update periodically
 * - Batch writes: Write once every 300ms or after accumulating 20 chunks
 *
 * Performance improvement:
 * - Before: 1000 UPDATE operations (one per chunk)
 * - After: ~10 UPDATE operations (periodic batch)
 * - Improvement: 100x
 */

interface StreamBuffer {
  messageId: string;
  conversationId: string;
  currentContent: string;
  chunkCount: number;
  lastDbUpdate: number;
  updateTimer?: NodeJS.Timeout;
  mode: 'accumulate' | 'replace'; // Independent mode per buffer to avoid concurrent conflicts
  /** Unique ID for database record */
  recordId?: string;
}

/**
 * Status for streaming messages
 * Note: 'partial' is represented as 'pending' with isPartial metadata
 */
export type StreamingStatus = 'pending' | 'finish' | 'error' | 'work';

/** Marker suffix added to partial response content */
export const PARTIAL_RESPONSE_MARKER = '\n\n---\n[Response interrupted]';

interface StreamingConfig {
  updateInterval?: number; // Update interval (milliseconds)
  chunkBatchSize?: number; // Update after how many chunks
}

export class StreamingMessageBuffer {
  private buffers = new Map<string, StreamBuffer>();

  // Default configuration
  private readonly UPDATE_INTERVAL = 300; // Update every 300ms
  private readonly CHUNK_BATCH_SIZE = 20; // Or accumulate 20 chunks

  constructor(private config?: StreamingConfig) {
    if (config?.updateInterval) {
      (this as any).UPDATE_INTERVAL = config.updateInterval;
    }
    if (config?.chunkBatchSize) {
      (this as any).CHUNK_BATCH_SIZE = config.chunkBatchSize;
    }
  }

  /**
   * Append streaming chunk
   *
   * @param id - Record ID
   * @param messageId - Unique message ID for merging
   * @param conversationId - Conversation ID
   * @param chunk - Text fragment
   * @param mode - Accumulate or replace mode
   *
   * Performance optimization: batch write instead of writing DB for each chunk
   */
  append(id: string, messageId: string, conversationId: string, chunk: string, mode: 'accumulate' | 'replace'): void {
    let buffer = this.buffers.get(messageId);

    if (!buffer) {
      // First chunk, initialize buffer (store mode in buffer, not instance)
      buffer = {
        messageId,
        conversationId,
        currentContent: chunk,
        chunkCount: 1,
        lastDbUpdate: Date.now(),
        mode, // Each buffer uses independent mode to avoid concurrent message mode conflicts
      };
      this.buffers.set(messageId, buffer);
    } else {
      // Accumulate or replace content based on buffer's mode (use buffer.mode not this.mode)
      if (buffer.mode === 'accumulate') {
        buffer.currentContent += chunk;
      } else {
        buffer.currentContent = chunk; // Replace mode: overwrite directly
      }
      buffer.chunkCount++;
    }

    // Clear old timer
    if (buffer.updateTimer) {
      clearTimeout(buffer.updateTimer);
      buffer.updateTimer = undefined;
    }

    // Determine if database update needed (based on count and time only)
    const shouldUpdate =
      buffer.chunkCount % this.CHUNK_BATCH_SIZE === 0 || // Accumulated enough chunks
      Date.now() - buffer.lastDbUpdate > this.UPDATE_INTERVAL; // Exceeded time interval

    if (shouldUpdate) {
      // Immediate update
      this.flushBuffer(id, messageId, false);
    } else {
      // Set delayed update (prevent message stream interruption)
      buffer.updateTimer = setTimeout(() => {
        this.flushBuffer(id, messageId, false);
      }, this.UPDATE_INTERVAL);
    }
  }

  /**
   * Flush buffer to database
   *
   * @param id - Record ID
   * @param messageId - Unique message ID for merging
   * @param clearBuffer - Whether to clear buffer (default false)
   * @param status - Message status (default 'pending')
   */
  private flushBuffer(id: string, messageId: string, clearBuffer = false, status: StreamingStatus = 'pending'): void {
    const buffer = this.buffers.get(messageId);
    if (!buffer) return;

    const db = getDatabase();

    try {
      const message: TMessage = {
        id: id,
        msg_id: messageId,
        conversation_id: buffer.conversationId,
        type: 'text',
        content: { content: buffer.currentContent },
        status: status,
        position: 'left',
        createdAt: Date.now(),
      };

      // Store record ID for future updates
      buffer.recordId = id;

      // Check if message exists in database
      const existing = db.getMessageByMsgId(buffer.conversationId, messageId, 'text');

      if (existing.success && existing.data) {
        // Message exists - update it
        db.updateMessage(existing.data.id, message);
      } else {
        // Message doesn't exist - insert it
        db.insertMessage(message);
      }

      // Update last write time
      buffer.lastDbUpdate = Date.now();

      // Clear buffer if needed
      if (clearBuffer) {
        this.buffers.delete(messageId);
      }
    } catch (error) {
      console.error(`[StreamingBuffer] Failed to flush buffer for ${messageId}:`, error);
    }
  }

  /**
   * Flush all active buffers with partial marker
   * Called when connection is interrupted to preserve partial responses
   *
   * @returns Array of messageIds that were flushed as partial
   */
  flushAllAsPartial(): string[] {
    const flushedIds: string[] = [];

    for (const [messageId, buffer] of this.buffers.entries()) {
      if (buffer.currentContent && buffer.currentContent.length > 0) {
        // Clear any pending timer
        if (buffer.updateTimer) {
          clearTimeout(buffer.updateTimer);
          buffer.updateTimer = undefined;
        }

        // Add partial marker to content
        buffer.currentContent += PARTIAL_RESPONSE_MARKER;

        // Flush with pending status (will be shown with interrupted marker in UI)
        const recordId = buffer.recordId || `partial-${messageId}-${Date.now()}`;
        this.flushBuffer(recordId, messageId, true, 'pending');
        flushedIds.push(messageId);

        console.log(`[StreamingBuffer] Preserved partial response for ${messageId} (${buffer.currentContent.length} chars)`);
      }
    }

    return flushedIds;
  }

  /**
   * Flush a specific buffer with partial marker
   * Called when a specific stream is interrupted
   *
   * @param messageId - The message ID to flush
   * @returns true if the buffer was flushed, false if not found
   */
  flushAsPartial(messageId: string): boolean {
    const buffer = this.buffers.get(messageId);
    if (!buffer || !buffer.currentContent || buffer.currentContent.length === 0) {
      return false;
    }

    // Clear any pending timer
    if (buffer.updateTimer) {
      clearTimeout(buffer.updateTimer);
      buffer.updateTimer = undefined;
    }

    // Add partial marker to content
    buffer.currentContent += PARTIAL_RESPONSE_MARKER;

    // Flush with pending status
    const recordId = buffer.recordId || `partial-${messageId}-${Date.now()}`;
    this.flushBuffer(recordId, messageId, true, 'pending');

    console.log(`[StreamingBuffer] Preserved partial response for ${messageId} (${buffer.currentContent.length} chars)`);
    return true;
  }

  /**
   * Complete a streaming message with final content
   *
   * @param id - Record ID
   * @param messageId - Message ID
   */
  complete(id: string, messageId: string): void {
    const buffer = this.buffers.get(messageId);
    if (!buffer) return;

    // Clear any pending timer
    if (buffer.updateTimer) {
      clearTimeout(buffer.updateTimer);
      buffer.updateTimer = undefined;
    }

    // Flush with finish status and clear buffer
    this.flushBuffer(id, messageId, true, 'finish');
  }

  /**
   * Check if there's an active buffer for a message
   */
  hasActiveBuffer(messageId: string): boolean {
    return this.buffers.has(messageId);
  }

  /**
   * Get the current content length for a message buffer
   */
  getBufferLength(messageId: string): number {
    const buffer = this.buffers.get(messageId);
    return buffer?.currentContent.length ?? 0;
  }
}

// Singleton instance
export const streamingBuffer = new StreamingMessageBuffer();
