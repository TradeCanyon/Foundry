/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConversationProvider } from '@/renderer/context/ConversationContext';
import SuggestedActionPills, { ActionTemplates, useActionPills } from '@renderer/components/SuggestedActionPills';
import FlexFullContainer from '@renderer/components/FlexFullContainer';
import MessageList from '@renderer/messages/MessageList';
import { MessageListProvider, useMessageLstCache, useMessageList } from '@renderer/messages/hooks';
import HOC from '@renderer/utils/HOC';
import React, { useCallback, useEffect } from 'react';
import LocalImageView from '../../../components/LocalImageView';
import ConversationChatConfirm from '../components/ConversationChatConfirm';
import CodexSendBox from './CodexSendBox';

const CodexChat: React.FC<{
  conversation_id: string;
  workspace: string;
}> = ({ conversation_id, workspace }) => {
  useMessageLstCache(conversation_id);
  const updateLocalImage = LocalImageView.useUpdateLocalImage();
  const messages = useMessageList();
  const { activeCategory, handleCategorySelect, pillsVisible, setHasMessages } = useActionPills();

  useEffect(() => {
    updateLocalImage({ root: workspace });
  }, [workspace]);

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
    <ConversationProvider value={{ conversationId: conversation_id, workspace, type: 'codex' }}>
      <div className='flex-1 flex flex-col px-20px'>
        <FlexFullContainer>
          <MessageList className='flex-1'></MessageList>
        </FlexFullContainer>
        <ConversationChatConfirm conversation_id={conversation_id}>
          <CodexSendBox conversation_id={conversation_id} />
        </ConversationChatConfirm>
        <div className='max-w-800px w-full mx-auto'>
          <SuggestedActionPills activeCategory={activeCategory} onCategorySelect={handleCategorySelect} visible={pillsVisible} />
          {activeCategory && <ActionTemplates category={activeCategory} onSelect={handleTemplateSelect} />}
        </div>
      </div>
    </ConversationProvider>
  );
};

export default HOC.Wrapper(MessageListProvider, LocalImageView.Provider)(CodexChat);
