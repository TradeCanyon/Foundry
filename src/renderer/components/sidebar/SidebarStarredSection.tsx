/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SidebarStarredSection — Shows starred conversations (up to 3, expandable).
 * Hidden when no starred conversations exist.
 */

import type { TChatConversation } from '@/common/storage';
import { Star } from '@icon-park/react';
import React, { useState } from 'react';

type SidebarStarredSectionProps = {
  conversations: TChatConversation[];
  collapsed: boolean;
  renderConversation: (conv: TChatConversation) => React.ReactNode;
  sectionStates: Record<string, boolean>;
  onToggleSection: (key: string) => void;
};

const SidebarStarredSection: React.FC<SidebarStarredSectionProps> = ({ conversations, collapsed, renderConversation, sectionStates, onToggleSection }) => {
  const [expanded, setExpanded] = useState(false);
  const isCollapsed = sectionStates['starred'] === false;

  if (conversations.length === 0) return null;

  const visibleCount = expanded ? conversations.length : 3;
  const visible = conversations.slice(0, visibleCount);
  const hasMore = conversations.length > 3 && !expanded;

  return (
    <div className='mb-2px'>
      {!collapsed && (
        <div className='flex items-center gap-6px px-12px pt-8px pb-4px cursor-pointer select-none' onClick={() => onToggleSection('starred')}>
          <Star theme='filled' size='12' fill='#f59e0b' />
          <span className='text-11px font-700 text-t-tertiary uppercase tracking-wider flex-1'>Starred</span>
          <span className='text-10px text-t-tertiary'>{conversations.length}</span>
        </div>
      )}
      {!isCollapsed && (
        <div className='flex flex-col gap-1px px-4px'>
          {visible.map((conv) => renderConversation(conv))}
          {hasMore && !collapsed && (
            <div className='px-12px py-3px text-11px text-t-tertiary cursor-pointer hover:text-t-secondary' onClick={() => setExpanded(true)}>
              View all starred ({conversations.length})
            </div>
          )}
          {expanded && conversations.length > 3 && !collapsed && (
            <div className='px-12px py-3px text-11px text-t-tertiary cursor-pointer hover:text-t-secondary' onClick={() => setExpanded(false)}>
              Show less
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SidebarStarredSection;
