/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * EmberChat — Lightweight chat component for Ember conversations.
 *
 * Uses local message state (not the full MessageListProvider pipeline).
 * Messages are sent via ember.send IPC and rendered inline.
 * Ember's memory system handles long-term context across sessions.
 */

import { ember } from '@/common/ipcBridge';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import EmberSendBox from './EmberSendBox';

interface EmberMessage {
  id: string;
  role: 'user' | 'ember';
  text: string;
  timestamp: number;
  intent?: string;
}

const EmberChat: React.FC<{ conversation_id: string }> = ({ conversation_id }) => {
  const [messages, setMessages] = useState<EmberMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(
    async (input: string) => {
      const userMessage: EmberMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: input,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);

      try {
        const response = await ember.send.invoke({
          input,
          conversationId: conversation_id,
          source: 'ui',
        });

        const emberMessage: EmberMessage = {
          id: `ember-${Date.now()}`,
          role: 'ember',
          text: response.text,
          timestamp: Date.now(),
          intent: response.intent,
        };

        setMessages((prev) => [...prev, emberMessage]);
      } catch {
        const errorMessage: EmberMessage = {
          id: `error-${Date.now()}`,
          role: 'ember',
          text: 'Something went wrong. Please try again.',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setLoading(false);
      }
    },
    [conversation_id]
  );

  return (
    <div className='flex-1 flex flex-col h-full'>
      <div ref={scrollRef} className='flex-1 overflow-y-auto px-20px py-16px'>
        {messages.length === 0 && (
          <div className='flex flex-col items-center justify-center h-full text-t-secondary select-none'>
            <div className='text-48px mb-16px' style={{ filter: 'drop-shadow(0 2px 8px rgba(255, 107, 53, 0.3))' }}>
              🔥
            </div>
            <div className='text-20px font-semibold mb-8px text-t-primary'>Hey, I'm Ember</div>
            <div className='text-14px max-w-400px text-center leading-relaxed'>Your personal AI assistant. I can answer questions, remember things, help you think through problems, and route complex tasks to specialist agents.</div>
          </div>
        )}
        <div className='max-w-700px mx-auto space-y-16px'>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-16px py-10px rd-16px text-14px leading-relaxed ${msg.role === 'user' ? 'bg-[rgb(var(--primary-6))] text-white rd-br-4px' : 'bg-fill-2 text-t-primary rd-bl-4px'}`}>
                <div className='whitespace-pre-wrap'>{msg.text}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className='flex justify-start'>
              <div className='bg-fill-2 text-t-secondary px-16px py-10px rd-16px rd-bl-4px text-14px'>
                <span className='animate-pulse'>Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <EmberSendBox onSend={handleSend} loading={loading} />
    </div>
  );
};

export default EmberChat;
