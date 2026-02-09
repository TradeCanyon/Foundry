/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SidebarRecentsSection — Shows recent standalone conversations (max 3, expandable).
 * Shows agent logos alongside each conversation.
 */

import type { TChatConversation } from '@/common/storage';
import { MessageOne } from '@icon-park/react';
import { Empty } from '@arco-design/web-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

type SidebarRecentsSectionProps = {
  conversations: TChatConversation[];
  collapsed: boolean;
  renderConversation: (conv: TChatConversation) => React.ReactNode;
  sectionStates: Record<string, boolean>;
  onToggleSection: (key: string) => void;
  onSessionClick?: () => void;
};

const SidebarRecentsSection: React.FC<SidebarRecentsSectionProps> = ({ conversations, collapsed, renderConversation, sectionStates, onToggleSection, onSessionClick }) => {
  const [expandLevel, setExpandLevel] = useState(0); // 0=3, 1=13, 2=23, etc.
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isCollapsed = sectionStates['recents'] === false;

  const visibleCount = 10 + expandLevel * 10;
  const visible = conversations.slice(0, visibleCount);
  const hasMore = conversations.length > visibleCount;

  return (
    <div className='mb-2px'>
      {!collapsed && (
        <div className='flex items-center gap-6px px-12px pt-8px pb-4px cursor-pointer select-none' onClick={() => onToggleSection('recents')}>
          <MessageOne theme='outline' size='12' />
          <span className='text-11px font-700 text-t-tertiary uppercase tracking-wider flex-1'>Recents</span>
          {conversations.length > 0 && <span className='text-10px text-t-tertiary'>{conversations.length}</span>}
        </div>
      )}
      {!isCollapsed && (
        <div className='flex flex-col gap-1px px-4px'>
          {visible.length === 0 && !collapsed && (
            <div className='flex-center py-16px'>
              <Empty description={t('conversation.history.noHistory')} />
            </div>
          )}
          {visible.map((conv) => renderConversation(conv))}
          {hasMore && !collapsed && (
            <div
              className='px-12px py-3px text-11px text-t-tertiary cursor-pointer hover:text-t-secondary'
              onClick={() => {
                if (conversations.length > visibleCount + 10) {
                  setExpandLevel((l) => l + 1);
                } else {
                  void navigate('/chats');
                  onSessionClick?.();
                }
              }}
            >
              View more
            </div>
          )}
          {expandLevel > 0 && !collapsed && (
            <div className='px-12px py-3px text-11px text-t-tertiary cursor-pointer hover:text-t-secondary' onClick={() => setExpandLevel(0)}>
              Show less
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SidebarRecentsSection;
