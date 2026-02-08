/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CodexToolCallUpdate, IMessageAcpToolCall, IMessageToolGroup, TMessage } from '@/common/chatLib';
import { useProcessingContextSafe } from '@/renderer/context/ConversationContext';
import { iconColors } from '@/renderer/theme/colors';
import { Image } from '@arco-design/web-react';
import { Down } from '@icon-park/react';
import PulseIndicator from '@renderer/components/PulseIndicator';
import MessageAcpPermission from '@renderer/messages/acp/MessageAcpPermission';
import MessageAcpToolCall from '@renderer/messages/acp/MessageAcpToolCall';
import MessageAgentStatus from '@renderer/messages/MessageAgentStatus';
import classNames from 'classnames';
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { VirtuosoHandle } from 'react-virtuoso';
import { Virtuoso } from 'react-virtuoso';
import { uuid } from '../utils/common';
import HOC from '../utils/HOC';
import MessageCodexToolCall from './codex/MessageCodexToolCall';
import type { FileChangeInfo } from './codex/MessageFileChanges';
import MessageFileChanges, { parseDiff } from './codex/MessageFileChanges';
import { useMessageList } from './hooks';
import MessagePlan from './MessagePlan';
import MessageTips from './MessageTips';
import MessageToolCall from './MessageToolCall';
import MessageToolGroup from './MessageToolGroup';
import MessageToolGroupSummary from './MessageToolGroupSummary';
import MessageText from './MessagetText';
import type { WriteFileResult } from './types';

type TurnDiffContent = Extract<CodexToolCallUpdate, { subtype: 'turn_diff' }>;

type IMessageVO =
  | TMessage
  | { type: 'file_summary'; id: string; diffs: FileChangeInfo[] }
  | {
      type: 'tool_summary';
      id: string;
      messages: Array<IMessageToolGroup | IMessageAcpToolCall>;
    };

// Image preview context
export const ImagePreviewContext = createContext<{ inPreviewGroup: boolean }>({ inPreviewGroup: false });

const MessageItem: React.FC<{ message: TMessage }> = React.memo(
  HOC((props) => {
    const { message } = props as { message: TMessage };
    return (
      <div
        className={classNames('flex items-start message-item [&>div]:max-w-full px-8px m-t-10px max-w-full md:max-w-780px mx-auto', message.type, {
          'justify-center': message.position === 'center',
          'justify-end': message.position === 'right',
          'justify-start': message.position === 'left',
        })}
      >
        {props.children}
      </div>
    );
  })(({ message }) => {
    const { t } = useTranslation();
    switch (message.type) {
      case 'text':
        return <MessageText message={message}></MessageText>;
      case 'tips':
        return <MessageTips message={message}></MessageTips>;
      case 'tool_call':
        return <MessageToolCall message={message}></MessageToolCall>;
      case 'tool_group':
        return <MessageToolGroup message={message}></MessageToolGroup>;
      case 'agent_status':
        return <MessageAgentStatus message={message}></MessageAgentStatus>;
      case 'acp_permission':
        return <MessageAcpPermission message={message}></MessageAcpPermission>;
      case 'acp_tool_call':
        return <MessageAcpToolCall message={message}></MessageAcpToolCall>;
      case 'codex_permission':
        // Permission UI is now handled by ConversationChatConfirm component
        return null;
      case 'codex_tool_call':
        return <MessageCodexToolCall message={message}></MessageCodexToolCall>;
      case 'plan':
        return <MessagePlan message={message}></MessagePlan>;
      default:
        return <div>{t('messages.unknownMessageType', { type: (message as any).type })}</div>;
    }
  }),
  (prev, next) => prev.message.id === next.message.id && prev.message.content === next.message.content && prev.message.position === next.message.position && prev.message.type === next.message.type
);

// Foundry-themed thinking phrases for when no specific status is available
const FOUNDRY_THINKING_PHRASES = ['Forging thoughts', 'Heating up the logic', 'Tempering ideas', 'Smelting possibilities', 'Casting the approach', 'Hammering out details', 'Shaping the response', 'Stoking the furnace', 'Refining the alloy'];

// Stable Footer component — reads from context directly so it doesn't cause parent re-renders
const ThinkingFooter: React.FC = () => {
  const processingContext = useProcessingContextSafe();
  const isProcessing = processingContext?.isProcessing ?? false;
  const statusMessage = processingContext?.statusMessage ?? '';
  const [phraseIndex, setPhraseIndex] = useState(() => Math.floor(Math.random() * FOUNDRY_THINKING_PHRASES.length));

  useEffect(() => {
    if (!isProcessing) return;
    setPhraseIndex(Math.floor(Math.random() * FOUNDRY_THINKING_PHRASES.length));
    if (statusMessage) return;
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % FOUNDRY_THINKING_PHRASES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isProcessing, statusMessage]);

  if (!isProcessing) return <div className='h-20px' />;

  const displayText = statusMessage || FOUNDRY_THINKING_PHRASES[phraseIndex % FOUNDRY_THINKING_PHRASES.length];

  return (
    <div className='min-h-60px'>
      <div className='flex items-center gap-10px px-8px py-12px max-w-780px mx-auto'>
        <PulseIndicator size={28} primaryColor='#ff6b35' secondaryColor='#ffaa00' />
        <span className='text-14px text-t-secondary font-medium'>
          {displayText}
          <span className='inline-block w-20px text-left animate-pulse'>...</span>
        </span>
      </div>
    </div>
  );
};

// Stable header component
const VirtuosoHeader: React.FC = () => <div className='h-10px' />;

// Stable components object — never changes reference, prevents Virtuoso from re-mounting
const VIRTUOSO_COMPONENTS = {
  Header: VirtuosoHeader,
  Footer: ThinkingFooter,
};

const MessageList: React.FC<{ className?: string }> = () => {
  const list = useMessageList();
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const previousListLengthRef = useRef(list.length);
  const { t } = useTranslation();

  // Pre-process message list to group Codex turn_diff messages
  const processedList = useMemo(() => {
    const result: Array<IMessageVO> = [];
    let diffsChanges: FileChangeInfo[] = [];
    let toolList: Array<IMessageToolGroup | IMessageAcpToolCall> = [];

    const pushFileDffChanges = (changes: FileChangeInfo) => {
      if (!diffsChanges.length) {
        result.push({ type: 'file_summary', id: `summary-${uuid()}`, diffs: diffsChanges });
      }
      diffsChanges.push(changes);
      toolList = [];
    };
    const pushToolList = (message: IMessageToolGroup | IMessageAcpToolCall) => {
      if (!toolList.length) {
        // Use message id as base for unique key to avoid duplicate key warnings
        result.push({ type: 'tool_summary', id: `tool-summary-${message.id || uuid()}`, messages: toolList });
      }
      toolList.push(message);
      diffsChanges = [];
    };

    for (let i = 0, len = list.length; i < len; i++) {
      const message = list[i];
      if (message.type === 'codex_tool_call' && message.content.subtype === 'turn_diff') {
        pushFileDffChanges(parseDiff((message.content as TurnDiffContent).data.unified_diff));
        continue;
      }
      if (message.type === 'tool_group') {
        if (message.content.length === 1) {
          const writeFileResults = message.content.filter((item) => item.name === 'WriteFile' && item.resultDisplay && typeof item.resultDisplay === 'object' && 'fileDiff' in item.resultDisplay).map((item) => item.resultDisplay as WriteFileResult);
          if (writeFileResults.length && writeFileResults[0].fileDiff) {
            pushFileDffChanges(parseDiff(writeFileResults[0].fileDiff, writeFileResults[0].fileName));
            continue;
          }
        }
        pushToolList(message);
        continue;
      }
      if (message.type === 'acp_tool_call') {
        pushToolList(message);
        continue;
      }
      toolList = [];
      diffsChanges = [];
      result.push(message);
    }
    return result;
  }, [list]);

  // Scroll to bottom
  const scrollToBottom = useCallback(
    (smooth = false) => {
      if (virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({
          index: processedList.length - 1,
          behavior: smooth ? 'smooth' : 'auto',
          align: 'end',
        });
      }
    },
    [processedList.length]
  );

  // Smart scroll when message list updates
  useEffect(() => {
    const currentListLength = list.length;
    const isNewMessage = currentListLength !== previousListLengthRef.current;

    // Update recorded list length
    previousListLengthRef.current = currentListLength;

    // Check if latest message is user-sent (position === 'right')
    const lastMessage = list[list.length - 1];
    const isUserMessage = lastMessage?.position === 'right';

    // If user-sent message, force scroll to bottom and reset scroll state
    if (isUserMessage && isNewMessage) {
      setAtBottom(true);
      setTimeout(() => {
        scrollToBottom();
      }, 100);
      return;
    }

    // If user not at bottom and no new message added, don't auto-scroll
    // Only auto-scroll when new message added and originally at bottom
    if (isNewMessage && atBottom) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [list, atBottom, scrollToBottom]);

  // Click scroll button
  const handleScrollButtonClick = () => {
    scrollToBottom(true);
    setShowScrollButton(false);
    setAtBottom(true);
  };

  const renderItem = (index: number, item: (typeof processedList)[0]) => {
    if ('type' in item && ['file_summary', 'tool_summary'].includes(item.type)) {
      return (
        <div key={item.id} className={'w-full message-item px-8px m-t-10px max-w-full md:max-w-780px mx-auto ' + item.type}>
          {item.type === 'file_summary' && <MessageFileChanges diffsChanges={item.diffs} />}
          {item.type === 'tool_summary' && <MessageToolGroupSummary messages={item.messages}></MessageToolGroupSummary>}
        </div>
      );
    }
    return <MessageItem message={item as TMessage} key={(item as TMessage).id}></MessageItem>;
  };

  return (
    <div className='relative flex-1 h-full'>
      {/* Wrap all messages with PreviewGroup to enable cross-message image preview */}
      <Image.PreviewGroup actionsLayout={['zoomIn', 'zoomOut', 'originalSize', 'rotateLeft', 'rotateRight']}>
        <ImagePreviewContext.Provider value={{ inPreviewGroup: true }}>
          <Virtuoso
            ref={virtuosoRef}
            className='flex-1 h-full pb-10px box-border'
            data={processedList}
            initialTopMostItemIndex={processedList.length - 1}
            atBottomStateChange={(isAtBottom) => {
              setAtBottom(isAtBottom);
              setShowScrollButton(!isAtBottom);
            }}
            atBottomThreshold={100}
            increaseViewportBy={200}
            itemContent={renderItem}
            followOutput='auto'
            components={VIRTUOSO_COMPONENTS}
          />
        </ImagePreviewContext.Provider>
      </Image.PreviewGroup>

      {showScrollButton && (
        <>
          {/* Gradient mask */}
          <div className='absolute bottom-0 left-0 right-0 h-100px pointer-events-none' />
          {/* Scroll button */}
          <div className='absolute bottom-20px left-50% transform -translate-x-50% z-100 foundry-bounce-in'>
            <div className='flex items-center justify-center w-40px h-40px rd-full bg-base shadow-lg cursor-pointer hover:bg-1 transition-all foundry-hover-grow foundry-press-scale border-1 border-solid border-3' onClick={handleScrollButtonClick} title={t('messages.scrollToBottom')} style={{ lineHeight: 0 }}>
              <Down theme='filled' size='20' fill={iconColors.secondary} style={{ display: 'block' }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MessageList;
