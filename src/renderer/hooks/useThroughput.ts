/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ipcBridge } from '@/common';

interface ThroughputInfo {
  /** Current tokens per second rate */
  tokensPerSecond: number;
  /** Whether streaming is active */
  isStreaming: boolean;
  /** Total tokens received in current stream */
  totalTokens: number;
}

interface UseThroughputOptions {
  conversationId: string;
  /** Window size in ms for calculating rate (default: 2000ms) */
  windowSize?: number;
}

/**
 * Hook to calculate token throughput from streaming events
 * Tracks text delta events to compute tokens per second
 */
export function useThroughput(options: UseThroughputOptions): ThroughputInfo {
  const { conversationId, windowSize = 2000 } = options;

  const [tokensPerSecond, setTokensPerSecond] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);

  // Track token arrivals for rate calculation
  const tokenTimestampsRef = useRef<number[]>([]);
  const tokenCountsRef = useRef<number[]>([]);
  const streamStartRef = useRef<number | null>(null);

  const calculateRate = useCallback(() => {
    const now = Date.now();
    const cutoff = now - windowSize;

    // Filter to only recent timestamps
    const recentIndices: number[] = [];
    tokenTimestampsRef.current.forEach((ts, i) => {
      if (ts >= cutoff) {
        recentIndices.push(i);
      }
    });

    if (recentIndices.length === 0) {
      setTokensPerSecond(0);
      return;
    }

    // Sum tokens in the window
    let tokensInWindow = 0;
    recentIndices.forEach((i) => {
      tokensInWindow += tokenCountsRef.current[i];
    });

    // Calculate rate (tokens per second)
    const oldestInWindow = tokenTimestampsRef.current[recentIndices[0]];
    const timeSpan = Math.max(now - oldestInWindow, 100); // At least 100ms to avoid division issues
    const rate = (tokensInWindow / timeSpan) * 1000;

    setTokensPerSecond(rate);

    // Prune old entries
    tokenTimestampsRef.current = recentIndices.map((i) => tokenTimestampsRef.current[i]);
    tokenCountsRef.current = recentIndices.map((i) => tokenCountsRef.current[i]);
  }, [windowSize]);

  const handleStreamEvent = useCallback(
    (event: { type: string; conversation_id?: string; text?: string }) => {
      // Filter by conversation
      if (event.conversation_id && event.conversation_id !== conversationId) {
        return;
      }

      switch (event.type) {
        case 'start':
          setIsStreaming(true);
          setTotalTokens(0);
          tokenTimestampsRef.current = [];
          tokenCountsRef.current = [];
          streamStartRef.current = Date.now();
          break;

        case 'text':
        case 'text_delta': {
          // Estimate tokens from text (rough: ~4 chars per token)
          const text = event.text || '';
          const estimatedTokens = Math.max(1, Math.ceil(text.length / 4));

          tokenTimestampsRef.current.push(Date.now());
          tokenCountsRef.current.push(estimatedTokens);
          setTotalTokens((prev) => prev + estimatedTokens);
          calculateRate();
          break;
        }

        case 'finish':
          setIsStreaming(false);
          setTokensPerSecond(0);
          streamStartRef.current = null;
          break;

        case 'error':
          setIsStreaming(false);
          setTokensPerSecond(0);
          streamStartRef.current = null;
          break;
      }
    },
    [conversationId, calculateRate]
  );

  // Subscribe to stream events
  useEffect(() => {
    const unsubscribers = [ipcBridge.geminiConversation?.responseStream?.on(handleStreamEvent), ipcBridge.acpConversation?.responseStream?.on(handleStreamEvent), ipcBridge.codexConversation?.responseStream?.on(handleStreamEvent)].filter(Boolean);

    return () => {
      unsubscribers.forEach((unsub) => unsub?.());
    };
  }, [handleStreamEvent]);

  // Decay rate when no new tokens arrive
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      calculateRate();
    }, 500);

    return () => clearInterval(interval);
  }, [isStreaming, calculateRate]);

  return {
    tokensPerSecond,
    isStreaming,
    totalTokens,
  };
}

export default useThroughput;
