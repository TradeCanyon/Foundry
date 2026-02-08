import { ipcBridge } from '@/common';
import type { IConfirmation } from '@/common/chatLib';
import { useConversationContextSafe } from '@/renderer/context/ConversationContext';
import { Divider, Typography } from '@arco-design/web-react';
import type { PropsWithChildren } from 'react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { removeStack } from '../../../utils/common';

// Priority mapping for permission options - lower number = higher priority (appears first)
// "Allow once" should be first, then "Always allow", then reject options
const OPTION_PRIORITY: Record<string, number> = {
  // Allow once variants (highest priority - safest single-use option)
  allow_once: 0,
  allow: 0,
  proceed_once: 0,
  proceed: 0,
  yes: 0,
  // Always allow variants
  allow_always: 1,
  always_allow: 1,
  proceed_always: 1,
  always: 1,
  // Reject/cancel variants
  reject_once: 2,
  reject: 2,
  deny: 2,
  deny_once: 2,
  no: 2,
  cancel: 3,
  reject_always: 4,
  deny_always: 4,
  always_reject: 4,
  always_deny: 4,
};

const getOptionPriority = (option: { label?: string; value?: any }): number => {
  // Check value (can be string or object with optionId/kind)
  const valueStr = typeof option.value === 'string' ? option.value.toLowerCase() : '';
  const optionId = (option.value?.optionId || '').toLowerCase();
  const kind = (option.value?.kind || '').toLowerCase();
  const label = (option.label || '').toLowerCase();

  // Try exact matches first
  if (valueStr && OPTION_PRIORITY[valueStr] !== undefined) return OPTION_PRIORITY[valueStr];
  if (optionId && OPTION_PRIORITY[optionId] !== undefined) return OPTION_PRIORITY[optionId];
  if (kind && OPTION_PRIORITY[kind] !== undefined) return OPTION_PRIORITY[kind];

  // Parse from label
  const hasAllow = label.includes('allow') || label.includes('proceed') || label.includes('yes');
  const hasReject = label.includes('reject') || label.includes('deny') || label.includes('cancel') || label.includes('no');
  const hasAlways = label.includes('always');

  if (hasAllow && !hasAlways) return 0;
  if (hasAllow && hasAlways) return 1;
  if (hasReject && !hasAlways) return 2;
  if (hasReject && hasAlways) return 4;

  return 99; // Unknown options go last
};

const ConversationChatConfirm: React.FC<PropsWithChildren<{ conversation_id: string }>> = ({ conversation_id, children }) => {
  const [confirmations, setConfirmations] = useState<IConfirmation<any>[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const { t } = useTranslation();
  const conversationContext = useConversationContextSafe();
  const agentType = conversationContext?.type || 'unknown';

  // Check if confirmation should be auto-confirmed via backend approval store
  // Keys are parsed in backend (single source of truth)
  const checkAndAutoConfirm = useCallback(
    async (confirmation: IConfirmation<string>): Promise<boolean> => {
      // Only check gemini agent type (others don't have approval store yet)
      if (agentType !== 'gemini') return false;

      const { action, commandType } = confirmation;
      // Skip if no action (backend will return false for empty keys)
      if (!action) return false;

      try {
        const isApproved = await ipcBridge.conversation.approval.check.invoke({
          conversation_id,
          action,
          commandType,
        });

        if (isApproved) {
          // Find the "proceed_always" or "proceed_once" option to use for auto-confirm
          const allowOption = confirmation.options.find((opt) => opt.value === 'proceed_always' || opt.value === 'proceed_once');
          if (allowOption) {
            void ipcBridge.conversation.confirmation.confirm.invoke({
              conversation_id,
              callId: confirmation.callId,
              msg_id: confirmation.id,
              data: allowOption.value,
            });
            return true;
          }
        }
      } catch {
        // Ignore errors, will show confirmation dialog
      }

      return false;
    },
    [conversation_id, agentType]
  );

  useEffect(() => {
    // Fix #475: Add error handling and retry mechanism
    let retryCount = 0;
    const maxRetries = 3;

    const loadConfirmations = async () => {
      try {
        const data = await ipcBridge.conversation.confirmation.list.invoke({ conversation_id });
        // Filter out confirmations that should be auto-confirmed (async)
        const manualConfirmations: IConfirmation<any>[] = [];
        for (const c of data) {
          const shouldAutoConfirm = await checkAndAutoConfirm(c);
          if (!shouldAutoConfirm) {
            manualConfirmations.push(c);
          }
        }
        setConfirmations(manualConfirmations);
        setLoadError(null);
      } catch (error) {
        console.error('[ConversationChatConfirm] Failed to load confirmations:', error);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(loadConfirmations, 1000);
        } else {
          const errorMsg = error instanceof Error ? error.message : 'Failed to load confirmations';
          setLoadError(errorMsg);
        }
      }
    };

    void loadConfirmations();

    return removeStack(
      ipcBridge.conversation.confirmation.add.on((data) => {
        if (conversation_id !== data.conversation_id) return;
        // Check if should auto-confirm (async)
        void checkAndAutoConfirm(data).then((autoConfirmed) => {
          if (!autoConfirmed) {
            setConfirmations((prev) => prev.concat(data));
            setLoadError(null);
          }
        });
      }),
      ipcBridge.conversation.confirmation.remove.on((data) => {
        if (conversation_id !== data.conversation_id) return;
        setConfirmations((prev) => prev.filter((p) => p.id !== data.id));
      }),
      ipcBridge.conversation.confirmation.update.on(({ ...data }) => {
        if (conversation_id !== data.conversation_id) return;
        setConfirmations((list) => {
          const original = list.find((p) => p.id === data.id);
          if (original) {
            Object.assign(original, data);
          }
          return list.slice();
        });
      })
    );
  }, [conversation_id, checkAndAutoConfirm]);

  // Get the current confirmation and sort its options
  const confirmation = confirmations.length > 0 ? confirmations[0] : null;

  // Sort options: "Allow" first, then "Always Allow", then reject options
  const sortedOptions = useMemo(() => {
    if (!confirmation?.options) return [];
    return [...confirmation.options].sort((a, b) => getOptionPriority(a) - getOptionPriority(b));
  }, [confirmation?.options]);

  // Reset selected index when confirmation changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [confirmation?.id]);

  // Confirm the selected option
  const confirmOption = useCallback(
    (option: { label: string; value: any }) => {
      if (!confirmation) return;
      setConfirmations((prev) => prev.filter((p) => p.id !== confirmation.id));
      void ipcBridge.conversation.confirmation.confirm.invoke({
        conversation_id,
        callId: confirmation.callId,
        msg_id: confirmation.id,
        data: option.value,
      });
    },
    [confirmation, conversation_id]
  );

  // Handle keyboard navigation: Enter to confirm, Arrow keys to navigate, ESC to cancel
  useEffect(() => {
    if (!confirmation || sortedOptions.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && event.shiftKey) {
        // Shift+Enter: always allow
        event.preventDefault();
        const alwaysAllowOption = sortedOptions.find((opt) => getOptionPriority(opt) === 1);
        if (alwaysAllowOption) {
          confirmOption(alwaysAllowOption);
        }
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const selectedOption = sortedOptions[selectedIndex];
        if (selectedOption) {
          confirmOption(selectedOption);
        }
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev < sortedOptions.length - 1 ? prev + 1 : 0));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : sortedOptions.length - 1));
      } else if (event.key === 'Escape') {
        // Find cancel option
        const cancelOption = sortedOptions.find((opt) => opt.value === 'cancel' || (typeof opt.value === 'object' && opt.value?.optionId?.includes('reject')));
        if (cancelOption) {
          event.preventDefault();
          confirmOption(cancelOption);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [confirmation, sortedOptions, selectedIndex, confirmOption]);
  // Fix #475: If loading fails, show error message and retry button
  if (loadError && !confirmations.length) {
    return (
      <div>
        {/* Error notification card */}
        <div
          className={`relative p-16px bg-white flex flex-col overflow-hidden m-b-20px rd-20px max-w-800px w-full mx-auto box-border`}
          style={{
            boxShadow: '0px 2px 20px 0px rgba(74, 88, 250, 0.1)',
          }}
        >
          {/* Error title */}
          <div className='color-[rgba(217,45,32,1)] text-14px font-medium mb-8px'>{t('conversation.confirmationLoadError', 'Failed to load confirmation dialog')}</div>
          {/* Error details */}
          <div className='text-12px color-[rgba(134,144,156,1)] mb-12px'>{loadError}</div>
          {/* Manual retry button */}
          <button
            onClick={() => {
              setLoadError(null);
              void ipcBridge.conversation.confirmation.list
                .invoke({ conversation_id })
                .then((data) => setConfirmations(data))
                .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load'));
            }}
            className='px-12px py-6px bg-[rgba(22,93,255,1)] text-white rd-6px text-12px cursor-pointer hover:opacity-80 transition-opacity'
          >
            {t('common.retry', 'Retry')}
          </button>
        </div>
        {children}
      </div>
    );
  }

  if (!confirmation) return <>{children}</>;
  const $t = (key: string, params?: Record<string, string>) => t(key, { ...params, defaultValue: key });
  return (
    <div
      className={`relative p-16px bg-white flex flex-col overflow-hidden m-b-20px rd-20px max-w-800px max-h-[calc(100vh-200px)] w-full mx-auto box-border`}
      style={{
        boxShadow: '0px 2px 20px 0px rgba(74, 88, 250, 0.1)',
      }}
    >
      <div className='color-[rgba(29,33,41,1)] text-16px font-bold shrink-0'>{$t(confirmation.title) || 'Choose an action'}:</div>
      <Divider className={'!my-10px shrink-0'}></Divider>
      <div className='flex-1 overflow-y-auto min-h-0'>
        <Typography.Ellipsis className='text-14px color-[rgba(29,33,41,1)]' rows={5} expandable>
          {$t(confirmation.description)}
        </Typography.Ellipsis>
      </div>
      <div className='shrink-0'>
        {sortedOptions.map((option, index) => {
          const label = $t(option.label, option.params);
          const isSelected = index === selectedIndex;
          const isFirst = index === 0;
          const isAlwaysAllow = getOptionPriority(option) === 1;
          return (
            <div onClick={() => confirmOption(option)} onMouseEnter={() => setSelectedIndex(index)} key={label + (typeof option.value === 'string' ? option.value : JSON.stringify(option.value)) + index} className={`b-1px b-solid h-30px lh-30px rd-8px px-12px cursor-pointer mt-10px transition-colors ${isSelected ? 'bg-[rgba(22,93,255,0.1)] b-[rgba(22,93,255,0.5)] text-[rgba(22,93,255,1)] font-medium' : 'b-[rgba(229,230,235,1)] hover:bg-[rgba(229,231,240,1)]'}`}>
              {label}
              {isFirst && <span className='text-12px ml-8px opacity-60'>(Enter)</span>}
              {isAlwaysAllow && <span className='text-12px ml-8px opacity-60'>(Shift+Enter)</span>}
            </div>
          );
        })}
      </div>
      <div className='hidden'>{children}</div>
    </div>
  );
};

export default ConversationChatConfirm;
