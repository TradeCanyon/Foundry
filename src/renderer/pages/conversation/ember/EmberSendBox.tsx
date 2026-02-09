/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * EmberSendBox — Minimal input for Ember conversations.
 *
 * Stripped-down send box: text input + send button.
 * No file attachments, no model selector, no tool controls.
 */

import { Button, Input } from '@arco-design/web-react';
import { ArrowUp } from '@icon-park/react';
import React, { useCallback, useRef, useState } from 'react';

interface EmberSendBoxProps {
  onSend: (message: string) => Promise<void>;
  loading?: boolean;
}

const EmberSendBox: React.FC<EmberSendBoxProps> = ({ onSend, loading }) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput('');
    await onSend(trimmed);
    inputRef.current?.focus();
  }, [input, loading, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className='px-20px pb-20px'>
      <div className='max-w-700px mx-auto flex items-end gap-8px bg-fill-1 rd-16px p-8px border b-solid border-[var(--color-border-2)]'>
        <Input.TextArea ref={inputRef as any} autoSize={{ minRows: 1, maxRows: 6 }} value={input} onChange={setInput} onKeyDown={handleKeyDown} placeholder='Message Ember...' className='!bg-transparent !b-none !resize-none text-14px' autoFocus />
        <Button shape='circle' type='primary' size='small' loading={loading} disabled={!input.trim()} icon={<ArrowUp theme='outline' size='14' fill='white' strokeWidth={2} />} onClick={() => void handleSend()} />
      </div>
    </div>
  );
};

export default EmberSendBox;
