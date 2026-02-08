/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Alert, Button, Input } from '@arco-design/web-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FoundryModal from './base/FoundryModal';

const { TextArea } = Input;

export interface EditMessageModalProps {
  visible: boolean;
  messageId: string;
  originalContent: string;
  onCancel: () => void;
  onSave: (newContent: string, resend: boolean) => Promise<void>;
}

/**
 * Modal for editing a sent message
 * Shows warning that subsequent messages will be deleted
 */
const EditMessageModal: React.FC<EditMessageModalProps> = ({ visible, messageId, originalContent, onCancel, onSave }) => {
  const { t } = useTranslation();
  const [content, setContent] = useState(originalContent);
  const [saving, setSaving] = useState(false);

  // Reset content when modal opens with new message
  useEffect(() => {
    if (visible) {
      setContent(originalContent);
    }
  }, [visible, originalContent]);

  const handleSave = useCallback(
    async (resend: boolean) => {
      if (!content.trim()) return;
      setSaving(true);
      try {
        await onSave(content, resend);
      } catch (error) {
        console.error('[EditMessageModal] Save error:', error);
      } finally {
        setSaving(false);
      }
    },
    [content, onSave]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enter (without Shift) to save and resend
      // Shift+Enter allows new line (default textarea behavior)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSave(true);
      }
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSave, onCancel]
  );

  const footer = (
    <div className='flex justify-end gap-10px mt-16px'>
      <Button onClick={onCancel} disabled={saving} style={{ borderRadius: 8 }}>
        {t('common.cancel')}
      </Button>
      <Button type='primary' onClick={() => handleSave(true)} loading={saving} disabled={!content.trim()} style={{ borderRadius: 8 }}>
        {t('messages.edit.saveAndResend')}
      </Button>
    </div>
  );

  return (
    <FoundryModal visible={visible} onCancel={onCancel} header={t('messages.edit.title')} footer={footer} maskClosable={false} style={{ width: '500px' }} contentStyle={{ padding: '16px', overflow: 'visible' }}>
      <div className='flex flex-col gap-12px'>
        <Alert type='warning' content={t('messages.edit.warning')} showIcon />
        <TextArea value={content} onChange={setContent} onKeyDown={handleKeyDown} placeholder={t('messages.edit.placeholder')} autoSize={{ minRows: 3, maxRows: 10 }} autoFocus style={{ borderRadius: 8 }} />
      </div>
    </FoundryModal>
  );
};

export default EditMessageModal;
