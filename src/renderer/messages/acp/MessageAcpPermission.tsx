/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageAcpPermission } from '@/common/chatLib';
import { conversation } from '@/common/ipcBridge';
import { Button, Card, Radio, Typography } from '@arco-design/web-react';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface MessageAcpPermissionProps {
  message: IMessageAcpPermission;
}

// Priority mapping for ACP permission options
// Order: Allow once (0) > Allow always (1) > Reject once (2) > Reject always (3)
const KIND_PRIORITY: Record<string, number> = {
  // Standard ACP format
  allow_once: 0,
  allow_always: 1,
  reject_once: 2,
  reject_always: 3,
  // Alternative formats that CLIs might use
  allow: 0, // Treat plain "allow" as allow_once (most permissive single-use option)
  allowonce: 0,
  alwaysallow: 1,
  always_allow: 1,
  reject: 2,
  rejectonce: 2,
  deny: 2,
  deny_once: 2,
  denyonce: 2,
  rejectalways: 3,
  always_reject: 3,
  deny_always: 3,
  denyalways: 3,
  alwaysdeny: 3,
};

const getOptionPriority = (option: { kind?: string; optionId?: string; name?: string }): number => {
  const kind = (option?.kind || '').toLowerCase().replace(/[\s-]/g, '_');
  const optionId = (option?.optionId || '').toLowerCase().replace(/[\s-]/g, '_');
  const name = (option?.name || '').toLowerCase();

  // Debug logging
  console.log('[Permission] Option:', { kind, optionId, name, original: option });

  // First try exact match on kind field
  if (kind && KIND_PRIORITY[kind] !== undefined) {
    console.log(`[Permission] → Priority ${KIND_PRIORITY[kind]} (from kind: ${kind})`);
    return KIND_PRIORITY[kind];
  }

  // Then try optionId (often matches kind format)
  if (optionId && KIND_PRIORITY[optionId] !== undefined) {
    console.log(`[Permission] → Priority ${KIND_PRIORITY[optionId]} (from optionId: ${optionId})`);
    return KIND_PRIORITY[optionId];
  }

  // Fallback: parse from name using keyword detection
  // Important: Check for "always" FIRST since it's more specific
  const hasAllow = name.includes('allow');
  const hasReject = name.includes('reject') || name.includes('deny');
  const hasAlways = name.includes('always');

  if (hasAllow && !hasAlways) {
    console.log('[Permission] → Priority 0 (from name: allow once)');
    return 0;
  }
  if (hasAllow && hasAlways) {
    console.log('[Permission] → Priority 1 (from name: allow always)');
    return 1;
  }
  if (hasReject && !hasAlways) {
    console.log('[Permission] → Priority 2 (from name: reject once)');
    return 2;
  }
  if (hasReject && hasAlways) {
    console.log('[Permission] → Priority 3 (from name: reject always)');
    return 3;
  }

  console.log('[Permission] → Priority 99 (unknown)');
  return 99;
};

const MessageAcpPermission: React.FC<MessageAcpPermissionProps> = React.memo(({ message }) => {
  const { options = [], toolCall } = message.content || {};
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Sort options by priority: allow_once first, then allow_always, then reject
  const sortedOptions = useMemo(() => {
    if (!options || options.length === 0) return [];
    console.log('[Permission] Raw options from CLI:', JSON.stringify(options, null, 2));

    // Calculate priorities for each option
    const optionsWithPriority = options.map((opt) => ({
      option: opt,
      priority: getOptionPriority(opt),
    }));

    console.log(
      '[Permission] Options with priorities:',
      optionsWithPriority.map((o) => ({ name: o.option.name, optionId: o.option.optionId, kind: o.option.kind, priority: o.priority }))
    );

    // Sort by priority (ascending: 0 first, then 1, 2, 3)
    const sorted = optionsWithPriority.sort((a, b) => a.priority - b.priority).map((o) => o.option);

    console.log(
      '[Permission] Final sorted order:',
      sorted.map((o, i) => `${i + 1}. ${o.name || o.optionId}`)
    );
    return sorted;
  }, [options]);

  // Default select the first option (Allow) for quick Enter confirmation
  const defaultOption = useMemo(() => sortedOptions[0]?.optionId || null, [sortedOptions]);

  // Generate display info based on actual data
  const getToolInfo = () => {
    if (!toolCall) {
      return {
        title: t('messages.permissionRequest'),
        description: t('messages.agentRequestingPermission'),
        icon: '🔐',
      };
    }

    // Use actual data from toolCall directly
    const displayTitle = toolCall.title || toolCall.rawInput?.description || t('messages.permissionRequest');

    // Simple icon mapping
    const kindIcons: Record<string, string> = {
      edit: '✏️',
      read: '📖',
      fetch: '🌐',
      execute: '⚡',
    };

    return {
      title: displayTitle,
      icon: kindIcons[toolCall.kind || 'execute'] || '⚡',
    };
  };
  const { title, icon } = getToolInfo();
  const [selected, setSelected] = useState<string | null>(null);
  const [isResponding, setIsResponding] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const hasUserSelected = useRef(false);

  // Update selected when defaultOption changes (e.g., when options load)
  // Only auto-select if user hasn't manually selected an option
  useEffect(() => {
    if (defaultOption && !hasUserSelected.current) {
      setSelected(defaultOption);
    }
  }, [defaultOption]);

  // Track when user manually selects an option
  const handleSelectionChange = useCallback((value: string) => {
    hasUserSelected.current = true;
    setSelected(value);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (hasResponded || !selected) return;

    setIsResponding(true);
    try {
      const invokeData = {
        confirmKey: selected,
        msg_id: message.id,
        conversation_id: message.conversation_id,
        callId: toolCall?.toolCallId || message.id, // Use toolCallId or message.id as fallback
      };

      const result = await conversation.confirmMessage.invoke(invokeData);

      if (result.success) {
        setHasResponded(true);
      } else {
        // Handle failure case - could add error display here
        console.error('Failed to confirm permission:', result);
      }
    } catch (error) {
      // Handle error case - could add error logging here
      console.error('Error confirming permission:', error);
    } finally {
      setIsResponding(false);
    }
  }, [hasResponded, selected, message.id, message.conversation_id, toolCall?.toolCallId]);

  // Keyboard navigation: Enter to confirm, Arrow keys to navigate
  useEffect(() => {
    if (hasResponded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if this permission dialog is visible
      if (!containerRef.current) return;

      if (e.key === 'Enter' && selected && !isResponding) {
        e.preventDefault();
        void handleConfirm();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = sortedOptions.findIndex((opt) => opt?.optionId === selected);
        let newIndex: number;
        if (e.key === 'ArrowDown') {
          newIndex = currentIndex < sortedOptions.length - 1 ? currentIndex + 1 : 0;
        } else {
          newIndex = currentIndex > 0 ? currentIndex - 1 : sortedOptions.length - 1;
        }
        const newOption = sortedOptions[newIndex];
        if (newOption?.optionId) {
          handleSelectionChange(newOption.optionId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasResponded, selected, isResponding, sortedOptions, handleConfirm, handleSelectionChange]);

  if (!toolCall) {
    return null;
  }

  return (
    <Card ref={containerRef} className='mb-4' bordered={false} style={{ background: 'var(--bg-1)' }}>
      <div className='space-y-4'>
        {/* Header with icon and title */}
        <div className='flex items-center space-x-2'>
          <span className='text-2xl'>{icon}</span>
          <Text className='block'>{title}</Text>
        </div>
        {(toolCall.rawInput?.command || toolCall.title) && (
          <div>
            <Text className='text-xs text-t-secondary mb-1'>{t('messages.command')}</Text>
            <code className='text-xs bg-1 p-2 rounded block text-t-primary break-all'>{toolCall.rawInput?.command || toolCall.title}</code>
          </div>
        )}
        {!hasResponded && (
          <>
            <div className='mt-10px'>
              {t('messages.chooseAction')}
              <span className='text-t-tertiary text-12px ml-8px'>({t('common.pressEnterToConfirm')})</span>
            </div>
            <Radio.Group direction='vertical' size='mini' value={selected} onChange={handleSelectionChange}>
              {sortedOptions.length > 0 ? (
                sortedOptions.map((option, index) => {
                  const optionName = option?.name || `${t('messages.option')} ${index + 1}`;
                  const optionId = option?.optionId || `option_${index}`;
                  const isDefault = index === 0;
                  return (
                    <Radio key={optionId} value={optionId} className={isDefault ? 'font-medium' : ''}>
                      {optionName}
                      {isDefault && <span className='text-t-tertiary text-12px ml-4px'>({t('common.default')})</span>}
                    </Radio>
                  );
                })
              ) : (
                <Text type='secondary'>{t('messages.noOptionsAvailable')}</Text>
              )}
            </Radio.Group>
            <div className='flex justify-start pl-20px'>
              <Button type='primary' size='mini' disabled={!selected || isResponding} onClick={handleConfirm}>
                {isResponding ? t('messages.processing') : t('messages.confirm')}
              </Button>
            </div>
          </>
        )}

        {hasResponded && (
          <div className='mt-10px p-2 rounded-md border' style={{ backgroundColor: 'var(--color-success-light-1)', borderColor: 'rgb(var(--success-3))' }}>
            <Text className='text-sm' style={{ color: 'rgb(var(--success-6))' }}>
              ✓ {t('messages.responseSentSuccessfully')}
            </Text>
          </div>
        )}
      </div>
    </Card>
  );
});

export default MessageAcpPermission;
