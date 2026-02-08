/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

/**
 * Conversation context interface
 */
export interface ConversationContextValue {
  /**
   * Conversation ID
   */
  conversationId: string;

  /**
   * Workspace directory path
   */
  workspace?: string;

  /**
   * Conversation type
   */
  type: 'gemini' | 'acp' | 'codex';
}

/**
 * Processing state context interface
 */
export interface ProcessingContextValue {
  /** Whether the AI is currently processing/generating */
  isProcessing: boolean;
  /** Set the processing state */
  setIsProcessing: (value: boolean) => void;
  /** Dynamic status message describing what the AI is currently doing */
  statusMessage: string;
  /** Set the dynamic status message */
  setStatusMessage: (value: string) => void;
}

/**
 * Conversation context - provides conversation-level information such as workspace path
 */
const ConversationContext = createContext<ConversationContextValue | null>(null);

/**
 * Processing state context - used for sharing processing state between SendBox and MessageList
 */
const ProcessingContext = createContext<ProcessingContextValue | null>(null);

/**
 * Conversation context provider
 */
export const ConversationProvider: React.FC<{
  children: React.ReactNode;
  value: ConversationContextValue;
}> = ({ children, value }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const setProcessing = useCallback((val: boolean) => {
    setIsProcessing(val);
    if (!val) setStatusMessage('');
  }, []);

  const setStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
  }, []);

  const processingValue = useMemo(() => ({ isProcessing, setIsProcessing: setProcessing, statusMessage, setStatusMessage: setStatus }), [isProcessing, setProcessing, statusMessage, setStatus]);

  return (
    <ConversationContext.Provider value={value}>
      <ProcessingContext.Provider value={processingValue}>{children}</ProcessingContext.Provider>
    </ConversationContext.Provider>
  );
};

/**
 * Hook to use conversation context
 */
export const useConversationContext = (): ConversationContextValue => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversationContext must be used within ConversationProvider');
  }
  return context;
};

/**
 * Hook to safely use conversation context (returns null if not in provider)
 */
export const useConversationContextSafe = (): ConversationContextValue | null => {
  return useContext(ConversationContext);
};

/**
 * Hook to use processing state context
 */
export const useProcessingContext = (): ProcessingContextValue => {
  const context = useContext(ProcessingContext);
  if (!context) {
    throw new Error('useProcessingContext must be used within ConversationProvider');
  }
  return context;
};

/**
 * Hook to safely use processing context (returns null if not in provider)
 */
export const useProcessingContextSafe = (): ProcessingContextValue | null => {
  return useContext(ProcessingContext);
};
