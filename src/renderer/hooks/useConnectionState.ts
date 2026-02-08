/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ipcBridge } from '@/common';
import { ConnectionState } from '@/renderer/components/ConnectionStatusBanner';

export interface ConnectionStateInfo {
  state: ConnectionState;
  reconnectAttempt: number;
  maxReconnectAttempts: number;
  errorMessage?: string;
}

interface UseConnectionStateOptions {
  conversationId: string;
  /** Timeout in ms to consider connection stale (default: 90000) */
  heartbeatTimeout?: number;
  /** Maximum reconnect attempts (default: 3) */
  maxReconnectAttempts?: number;
}

/**
 * Hook to track connection state for a conversation
 * Derives state from stream events: start → connecting, finish → idle, errors → failed
 */
export function useConnectionState(options: UseConnectionStateOptions): ConnectionStateInfo & {
  retry: () => void;
} {
  const { conversationId, heartbeatTimeout = 90000, maxReconnectAttempts = 3 } = options;

  const [state, setState] = useState<ConnectionState>(ConnectionState.IDLE);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const lastEventTimeRef = useRef<number>(Date.now());
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset to idle after timeout
  const startHeartbeatCheck = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }

    heartbeatTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastEventTimeRef.current;
      if (elapsed > heartbeatTimeout && state === ConnectionState.CONNECTED) {
        // Connection seems stale, but don't mark as failed yet
        // Just return to idle
        setState(ConnectionState.IDLE);
      }
    }, 5000);
  }, [heartbeatTimeout, state]);

  // Handle stream events
  const handleStreamEvent = useCallback(
    (event: { type: string; conversation_id?: string; error?: string }) => {
      // Filter by conversation
      if (event.conversation_id && event.conversation_id !== conversationId) {
        return;
      }

      lastEventTimeRef.current = Date.now();

      switch (event.type) {
        case 'start':
          setState(ConnectionState.CONNECTING);
          setReconnectAttempt(0);
          setErrorMessage(undefined);
          break;

        case 'text':
        case 'thought':
        case 'tool_group':
        case 'tool_call':
          // Any content means we're connected
          if (state === ConnectionState.CONNECTING || state === ConnectionState.RECONNECTING) {
            setState(ConnectionState.CONNECTED);
          }
          break;

        case 'finish':
          setState(ConnectionState.IDLE);
          break;

        case 'error':
          setState(ConnectionState.FAILED);
          setErrorMessage(event.error || 'Connection error');
          break;

        case 'tips':
          // Check if it's an error tip
          if ('content' in event) {
            const tipEvent = event as { content?: { type?: string } };
            if (tipEvent.content?.type === 'error') {
              setState(ConnectionState.FAILED);
            }
          }
          break;
      }
    },
    [conversationId, state]
  );

  // Retry handler
  const retry = useCallback(() => {
    if (reconnectAttempt < maxReconnectAttempts) {
      setState(ConnectionState.RECONNECTING);
      setReconnectAttempt((prev) => prev + 1);
      // The actual retry is handled by the parent component
      // This just updates the UI state
    }
  }, [reconnectAttempt, maxReconnectAttempts]);

  // Subscribe to stream events
  useEffect(() => {
    const unsubscribers = [ipcBridge.geminiConversation?.responseStream?.on(handleStreamEvent), ipcBridge.acpConversation?.responseStream?.on(handleStreamEvent), ipcBridge.codexConversation?.responseStream?.on(handleStreamEvent)].filter(Boolean);

    startHeartbeatCheck();

    return () => {
      unsubscribers.forEach((unsub) => unsub?.());
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, [handleStreamEvent, startHeartbeatCheck]);

  return {
    state,
    reconnectAttempt,
    maxReconnectAttempts,
    errorMessage,
    retry,
  };
}

export default useConnectionState;
