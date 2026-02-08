/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Input } from '@arco-design/web-react';
import { ArrowUp } from '@icon-park/react';
import { useCompositionInput } from '@/renderer/hooks/useCompositionInput';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ImageSendBoxProps {
  onSend: (prompt: string) => void;
  disabled?: boolean;
}

const ImageSendBox: React.FC<ImageSendBoxProps> = ({ onSend, disabled }) => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const { compositionHandlers, isComposing } = useCompositionInput();

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  }, [input, onSend]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (isComposing.current) return;
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend, isComposing]
  );

  return (
    <div className='flex items-end gap-8px p-12px' style={{ borderTop: '1px solid var(--color-border-2)' }}>
      <Input.TextArea autoSize={{ minRows: 1, maxRows: 6 }} placeholder={t('image.promptPlaceholder', { defaultValue: 'Describe the image you want to generate...' })} className='flex-1 !bg-transparent !b-none !resize-none !p-4px text-14px' value={input} onChange={setInput} onKeyDown={handleKeyDown} disabled={disabled} {...compositionHandlers} />
      <Button shape='circle' type='primary' disabled={!input.trim() || disabled} icon={<ArrowUp theme='outline' size='14' fill='white' strokeWidth={2} />} onClick={handleSend} />
    </div>
  );
};

export default ImageSendBox;
