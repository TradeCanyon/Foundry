/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConversationProvider } from '@/renderer/context/ConversationContext';
import type { AcpBackend } from '@/types/acpTypes';
import SuggestedActionPills, { ActionTemplates, useActionPills } from '@renderer/components/SuggestedActionPills';
import FlexFullContainer from '@renderer/components/FlexFullContainer';
import MessageList from '@renderer/messages/MessageList';
import { MessageListProvider, useMessageLstCache, useMessageList } from '@renderer/messages/hooks';
import HOC from '@renderer/utils/HOC';
import React, { useCallback, useEffect } from 'react';
import ConversationChatConfirm from '../components/ConversationChatConfirm';
import AcpSendBox from './AcpSendBox';

const AcpChat: React.FC<{
  conversation_id: string;
  workspace?: string;
  backend: AcpBackend;
}> = ({ conversation_id, workspace, backend }) => {
  useMessageLstCache(conversation_id);
  const messages = useMessageList();
  const { activeCategory, handleCategorySelect, pillsVisible, setHasMessages } = useActionPills();

  useEffect(() => {
    setHasMessages(messages.length > 0);
  }, [messages.length, setHasMessages]);

  const handleTemplateSelect = useCallback(
    (template: string) => {
      void import('@/renderer/utils/emitter').then(({ emitter }) => {
        emitter.emit('sendbox.fill', template);
      });
      handleCategorySelect(null);
    },
    [handleCategorySelect]
  );

  return (
    <ConversationProvider value={{ conversationId: conversation_id, workspace, type: 'acp' }}>
      <div className='flex-1 flex flex-col px-20px'>
        <FlexFullContainer>
          <MessageList className='flex-1'></MessageList>
        </FlexFullContainer>
        <ConversationChatConfirm conversation_id={conversation_id}>
          <AcpSendBox conversation_id={conversation_id} backend={backend}></AcpSendBox>
        </ConversationChatConfirm>
        <div className='max-w-800px w-full mx-auto'>
          <SuggestedActionPills activeCategory={activeCategory} onCategorySelect={handleCategorySelect} visible={pillsVisible} />
          {activeCategory && <ActionTemplates category={activeCategory} onSelect={handleTemplateSelect} />}
        </div>
      </div>
    </ConversationProvider>
  );
};

export default HOC(MessageListProvider)(AcpChat);
