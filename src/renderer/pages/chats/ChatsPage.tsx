/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ChatsPage — Full conversation history with timeline groups and agent filter tabs.
 * Route: /chats
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/storage';
import { getConversationAgentLogo } from '@/renderer/utils/agentLogos';
import { getActivityTime, getTimelineLabel } from '@/renderer/utils/timeline';
import { addEventListener, emitter } from '@/renderer/utils/emitter';
import { MessageOne, Pic, Search, DeleteOne } from '@icon-park/react';
import { Button, Input, Message } from '@arco-design/web-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const AGENT_TABS = [
  { key: 'all', label: 'All' },
  { key: 'gemini', label: 'Gemini' },
  { key: 'acp:claude', label: 'Claude' },
  { key: 'codex', label: 'Codex' },
  { key: 'image', label: 'Image' },
  { key: 'ember', label: 'Ember' },
];

const ChatsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<TChatConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const refresh = () => {
      ipcBridge.database.getUserConversations
        .invoke({ page: 0, pageSize: 10000 })
        .then((data) => setConversations(Array.isArray(data) ? data : []))
        .catch(() => setConversations([]));
    };
    refresh();
    const cleanup = addEventListener('chat.history.refresh', refresh);
    return cleanup;
  }, []);

  const filtered = useMemo(() => {
    let result = conversations;

    // Filter by agent tab
    if (activeTab !== 'all') {
      if (activeTab.startsWith('acp:')) {
        const backend = activeTab.split(':')[1];
        result = result.filter((c) => c.type === 'acp' && (c.extra as any)?.backend === backend);
      } else {
        result = result.filter((c) => c.type === activeTab);
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }

    return result.sort((a, b) => getActivityTime(b) - getActivityTime(a));
  }, [conversations, activeTab, searchQuery]);

  // Group by timeline
  const timelineGroups = useMemo(() => {
    const groups: { label: string; conversations: TChatConversation[] }[] = [];
    const buckets = new Map<string, TChatConversation[]>();
    const now = Date.now();

    for (const conv of filtered) {
      const label = getTimelineLabel(getActivityTime(conv), now, t);
      if (!buckets.has(label)) buckets.set(label, []);
      buckets.get(label)!.push(conv);
    }

    const order = [t('conversation.history.today'), t('conversation.history.yesterday'), t('conversation.history.recent7Days'), t('conversation.history.earlier')];
    for (const label of order) {
      const convs = buckets.get(label);
      if (convs && convs.length > 0) groups.push({ label, conversations: convs });
    }
    return groups;
  }, [filtered, t]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`Delete ${selectedIds.size} conversation(s)?`);
    if (!confirmed) return;

    for (const id of selectedIds) {
      try {
        await ipcBridge.conversation.remove.invoke({ id });
      } catch {
        // continue
      }
    }
    setSelectedIds(new Set());
    emitter.emit('chat.history.refresh');
    Message.success(`Deleted ${selectedIds.size} conversations`);
  }, [selectedIds]);

  const formatTimeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className='size-full flex flex-col p-24px overflow-y-auto'>
      {/* Header */}
      <div className='flex items-center justify-between mb-20px'>
        <h1 className='text-22px font-600' style={{ color: 'var(--text-primary)' }}>
          Chats
        </h1>
        {selectedIds.size > 0 && (
          <Button type='outline' status='danger' size='small' icon={<DeleteOne theme='outline' size='14' />} onClick={() => void handleBulkDelete()}>
            Delete selected ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Search + filter tabs */}
      <div className='flex items-center gap-12px mb-16px'>
        <Input prefix={<Search theme='outline' size='14' />} placeholder='Search conversations...' value={searchQuery} onChange={setSearchQuery} allowClear style={{ maxWidth: '300px' }} />
      </div>

      {/* Agent tabs */}
      <div className='flex items-center gap-2px mb-16px'>
        {AGENT_TABS.map((tab) => (
          <div
            key={tab.key}
            className='px-12px py-5px rd-16px cursor-pointer text-13px'
            style={{
              backgroundColor: activeTab === tab.key ? 'var(--bg-3)' : 'transparent',
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontWeight: activeTab === tab.key ? 600 : 400,
            }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* Timeline groups */}
      {timelineGroups.length === 0 && <div className='flex-center py-48px text-t-tertiary text-14px'>{searchQuery ? 'No conversations found' : 'No conversations yet'}</div>}

      {timelineGroups.map((group) => (
        <div key={group.label} className='mb-20px'>
          <div className='text-12px font-600 text-t-tertiary uppercase tracking-wider mb-8px'>{group.label}</div>
          <div className='flex flex-col gap-2px'>
            {group.conversations.map((conv) => {
              const agentLogo = getConversationAgentLogo(conv);
              const isImage = conv.type === 'image';
              const isSelected = selectedIds.has(conv.id);

              return (
                <div key={conv.id} className='flex items-center gap-10px px-12px py-8px rd-8px cursor-pointer hover:bg-hover group' style={{ backgroundColor: isSelected ? 'var(--bg-2)' : undefined }} onClick={() => void navigate(`/conversation/${conv.id}`)}>
                  {/* Selection checkbox */}
                  <input
                    type='checkbox'
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelect(conv.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className='flex-shrink-0 opacity-0 group-hover:opacity-100'
                    style={{ opacity: isSelected ? 1 : undefined, accentColor: '#ff6b35' }}
                  />

                  {/* Agent logo */}
                  <div className='flex-shrink-0 w-20px h-20px flex items-center justify-center'>{agentLogo ? <img src={agentLogo} alt='' width={16} height={16} style={{ objectFit: 'contain' }} /> : isImage ? <Pic theme='outline' size='16' /> : conv.type === 'ember' ? <span style={{ fontSize: 14 }}>{'\u{1F525}'}</span> : <MessageOne theme='outline' size='16' />}</div>

                  {/* Name */}
                  <div className='flex-1 min-w-0 truncate text-14px' style={{ color: 'var(--text-primary)' }}>
                    {conv.name}
                  </div>

                  {/* Project badge */}
                  {(conv.extra as any)?.customWorkspace && (
                    <div className='text-10px px-6px py-1px rd-4px flex-shrink-0' style={{ backgroundColor: 'var(--bg-3)', color: 'var(--text-tertiary)' }}>
                      project
                    </div>
                  )}

                  {/* Time */}
                  <div className='text-12px flex-shrink-0' style={{ color: 'var(--text-tertiary)' }}>
                    {formatTimeAgo(getActivityTime(conv))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChatsPage;
