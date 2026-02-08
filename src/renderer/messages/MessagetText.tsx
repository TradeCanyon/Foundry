/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IMessageText } from '@/common/chatLib';
import { FOUNDRY_FILES_MARKER } from '@/common/constants';
import { iconColors } from '@/renderer/theme/colors';
import { uuid } from '@/renderer/utils/common';
import { Tooltip } from '@arco-design/web-react';
import { Copy, Edit, CheckOne } from '@icon-park/react';
import classNames from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CollapsibleContent from '../components/CollapsibleContent';
import EditMessageModal from '../components/EditMessageModal';
import FilePreview from '../components/FilePreview';
import HorizontalFileList from '../components/HorizontalFileList';
import MarkdownView from '../components/Markdown';
import MessageAvatar from '../components/MessageAvatar';
import { useUpdateMessageList } from './hooks';
import { emitter } from '../utils/emitter';

const parseFileMarker = (content: string) => {
  const markerIndex = content.indexOf(FOUNDRY_FILES_MARKER);
  if (markerIndex === -1) {
    return { text: content, files: [] as string[] };
  }
  const text = content.slice(0, markerIndex).trimEnd();
  const afterMarker = content.slice(markerIndex + FOUNDRY_FILES_MARKER.length).trim();
  const files = afterMarker
    ? afterMarker
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
  return { text, files };
};

const useFormatContent = (content: string) => {
  return useMemo(() => {
    try {
      const json = JSON.parse(content);
      const isJson = typeof json === 'object';
      return {
        json: isJson,
        data: isJson ? json : content,
      };
    } catch {
      return { data: content };
    }
  }, [content]);
};

const MessageText: React.FC<{ message: IMessageText }> = ({ message }) => {
  const { text, files } = parseFileMarker(message.content.content);
  const { data, json } = useFormatContent(text);
  const { t } = useTranslation();
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [showEditModal, setShowEditModal] = useState(false);
  const isUserMessage = message.position === 'right';
  const conversationId = message.conversation_id;
  const updateMessageList = useUpdateMessageList();

  // Filter empty content to avoid rendering empty DOM
  if (!message.content.content || (typeof message.content.content === 'string' && !message.content.content.trim())) {
    return null;
  }

  const handleCopy = () => {
    const baseText = json ? JSON.stringify(data, null, 2) : text;
    const fileList = files.length ? `Files:\n${files.map((path) => `- ${path}`).join('\n')}\n\n` : '';
    const textToCopy = fileList + baseText;
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        setCopyState('copied');
        setTimeout(() => setCopyState('idle'), 2000);
      })
      .catch((error) => {
        console.error('Copy failed:', error);
      });
  };

  const handleEditSave = useCallback(
    async (newContent: string, _resend: boolean) => {
      console.log('[MessageText.handleEditSave] Called with:', { messageId: message.id, conversationId, contentLength: newContent.length });

      if (!message.id || !conversationId) {
        console.error('[MessageText.handleEditSave] Missing message.id or conversationId, aborting');
        return;
      }

      // Get message timestamp - try createdAt first, fall back to current time
      const messageTimestamp = message.createdAt || Date.now();

      // Try to update database (but don't fail if it doesn't work - messages might not be persisted yet)
      try {
        await ipcBridge.database.deleteMessagesAfter.invoke({
          conversation_id: conversationId,
          afterTimestamp: messageTimestamp,
        });
        await ipcBridge.database.updateMessageContent.invoke({
          messageId: message.id,
          content: newContent,
        });
      } catch (dbError) {
        console.warn('[MessageText] Database update failed (non-fatal):', dbError);
      }

      // CRITICAL: Reset the agent first so it doesn't have stale conversation history
      // This kills the CLI process so we get a fresh agent with no memory of previous messages
      console.log('[MessageText.handleEditSave] Resetting agent...');
      try {
        await ipcBridge.conversation.reset.invoke({ id: conversationId });
      } catch (resetError) {
        console.warn('[MessageText.handleEditSave] Agent reset failed (non-fatal):', resetError);
      }

      // Update local message list - remove messages after this one AND any agent_status messages
      // Agent status messages should be removed because a new session will be started
      updateMessageList((list) => {
        const messageIndex = list.findIndex((m) => m.id === message.id);
        console.log('[MessageText.handleEditSave] Updating message list, messageIndex:', messageIndex, 'list length:', list.length);
        if (messageIndex === -1) return list;

        // Keep only messages up to (but NOT including) the edited message
        // Also filter out agent_status messages since we're starting a new session
        return list.slice(0, messageIndex).filter((m) => m.type !== 'agent_status');
      });

      setShowEditModal(false);

      // Generate new message ID for the edited message
      const newMsgId = uuid();
      console.log('[MessageText.handleEditSave] Creating new message with msg_id:', newMsgId);

      // NOTE: We don't add the user message here - the backend will emit it via responseStream
      // This prevents duplicate messages from appearing

      // Emit event to trigger thinking indicator in SendBox
      emitter.emit('conversation.message.sending', { conversation_id: conversationId });

      // Send to backend - this will create a fresh agent since we reset it above
      console.log('[MessageText.handleEditSave] Calling sendMessage...');
      try {
        const result = await ipcBridge.conversation.sendMessage.invoke({
          input: newContent,
          msg_id: newMsgId,
          conversation_id: conversationId,
        });
        console.log('[MessageText.handleEditSave] sendMessage result:', result);
      } catch (sendError) {
        console.error('[MessageText.handleEditSave] sendMessage error:', sendError);
      }
    },
    [message, conversationId, updateMessageList]
  );

  const copyButton = (
    <Tooltip content={copyState === 'copied' ? t('messages.copySuccess') : t('common.copy', { defaultValue: 'Copy' })}>
      <div className={classNames('p-4px rd-4px cursor-pointer hover:bg-3 transition-colors foundry-press-scale', 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto', copyState === 'copied' && 'foundry-success-pop')} onClick={handleCopy} style={{ lineHeight: 0 }}>
        {copyState === 'copied' ? <CheckOne theme='filled' size='16' fill='#22c55e' /> : <Copy theme='outline' size='16' fill={iconColors.secondary} />}
      </div>
    </Tooltip>
  );

  const editButton = isUserMessage ? (
    <Tooltip content={t('common.edit', { defaultValue: 'Edit' })}>
      <div className='p-4px rd-4px cursor-pointer hover:bg-3 transition-colors opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto mr-4px' onClick={() => setShowEditModal(true)} style={{ lineHeight: 0 }}>
        <Edit theme='outline' size='16' fill={iconColors.secondary} />
      </div>
    </Tooltip>
  ) : null;

  return (
    <>
      <div className={classNames('flex group w-full', isUserMessage ? 'flex-row-reverse foundry-fade-left' : 'flex-row foundry-fade-up')}>
        {/* Avatar */}
        <div className={classNames('flex-shrink-0', isUserMessage ? 'ml-8px' : 'mr-8px')}>
          <MessageAvatar isUser={isUserMessage} size='medium' />
        </div>

        {/* Message content */}
        <div className={classNames('flex flex-col min-w-0 max-w-[85%]', isUserMessage ? 'items-end' : 'items-start')}>
          {/* Attached files */}
          {files.length > 0 && (
            <div className='mb-6px'>
              {files.length === 1 ? (
                <div className='flex items-center'>
                  <FilePreview path={files[0]} onRemove={() => undefined} readonly />
                </div>
              ) : (
                <HorizontalFileList>
                  {files.map((path) => (
                    <FilePreview key={path} path={path} onRemove={() => undefined} readonly />
                  ))}
                </HorizontalFileList>
              )}
            </div>
          )}

          {/* Message bubble */}
          <div className={classNames('[&>p:first-child]:mt-0px [&>p:last-child]:mb-0px', isUserMessage ? 'rd-16px rd-tr-4px bg-primary/10 p-12px' : 'rd-16px rd-tl-4px bg-bg-2 p-12px border border-border-1')}>
            {json ? (
              <CollapsibleContent maxHeight={200} defaultCollapsed={true}>
                <MarkdownView codeStyle={{ marginTop: 4, marginBlock: 4 }}>{`\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``}</MarkdownView>
              </CollapsibleContent>
            ) : (
              <MarkdownView codeStyle={{ marginTop: 4, marginBlock: 4 }}>{data}</MarkdownView>
            )}
          </div>

          {/* Action buttons */}
          <div
            className={classNames('h-28px flex items-center mt-4px gap-4px', {
              'justify-end': isUserMessage,
              'justify-start': !isUserMessage,
            })}
          >
            {editButton}
            {copyButton}
          </div>
        </div>
      </div>
      {isUserMessage && <EditMessageModal visible={showEditModal} messageId={message.id} originalContent={text} onCancel={() => setShowEditModal(false)} onSave={handleEditSave} />}
    </>
  );
};

export default MessageText;
