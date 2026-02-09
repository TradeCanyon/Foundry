/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/storage';
import FlexFullContainer from '@/renderer/components/FlexFullContainer';
import { CronJobIndicator, useCronJobsMap } from '@/renderer/pages/cron';
import { addEventListener, emitter } from '@/renderer/utils/emitter';
import { getActivityTime, getTimelineLabel } from '@/renderer/utils/timeline';
import { getWorkspaceDisplayName } from '@/renderer/utils/workspace';
import { getWorkspaceUpdateTime } from '@/renderer/utils/workspaceHistory';
import { Empty, Input, Tooltip } from '@arco-design/web-react';
import { MessageOne } from '@icon-park/react';
import ConversationContextMenu from '@/renderer/components/ConversationContextMenu';
import ConversationSearch from '@/renderer/components/ConversationSearch';
import classNames from 'classnames';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useConversationTabs } from './context/ConversationTabsContext';
import WorkspaceCollapse from './WorkspaceCollapse';

interface WorkspaceGroup {
  workspace: string; // Full path
  displayName: string; // Display name
  conversations: TChatConversation[];
}

// Unified timeline item, can be workspace group or standalone conversation
interface TimelineItem {
  type: 'workspace' | 'conversation';
  time: number; // Time used for sorting
  workspaceGroup?: WorkspaceGroup; // Has value when type === 'workspace'
  conversation?: TChatConversation; // Has value when type === 'conversation'
}

interface TimelineSection {
  timeline: string; // Timeline title
  items: TimelineItem[]; // Items sorted by time after merging
}

// Helper to get timeline label for a conversation
const getConversationTimelineLabel = (conversation: TChatConversation, t: (key: string) => string): string => {
  const time = getActivityTime(conversation);
  return getTimelineLabel(time, Date.now(), t);
};

// Group by timeline and workspace
const groupConversationsByTimelineAndWorkspace = (conversations: TChatConversation[], t: (key: string) => string): TimelineSection[] => {
  // Step 1: Group all conversations by workspace
  const allWorkspaceGroups = new Map<string, TChatConversation[]>();
  const withoutWorkspaceConvs: TChatConversation[] = [];

  conversations.forEach((conv) => {
    const workspace = conv.extra?.workspace;
    const customWorkspace = conv.extra?.customWorkspace;

    if (customWorkspace && workspace) {
      if (!allWorkspaceGroups.has(workspace)) {
        allWorkspaceGroups.set(workspace, []);
      }
      allWorkspaceGroups.get(workspace)!.push(conv);
    } else {
      withoutWorkspaceConvs.push(conv);
    }
  });

  // Step 2: Determine which timeline each workspace group should appear in (using the time of the latest conversation in the group)
  const workspaceGroupsByTimeline = new Map<string, WorkspaceGroup[]>();

  allWorkspaceGroups.forEach((convList, workspace) => {
    // Sort conversations by time
    const sortedConvs = convList.sort((a, b) => getActivityTime(b) - getActivityTime(a));
    // Use the timeline of the latest conversation
    const latestConv = sortedConvs[0];
    const timeline = getConversationTimelineLabel(latestConv, t);

    if (!workspaceGroupsByTimeline.has(timeline)) {
      workspaceGroupsByTimeline.set(timeline, []);
    }

    workspaceGroupsByTimeline.get(timeline)!.push({
      workspace,
      displayName: getWorkspaceDisplayName(workspace),
      conversations: sortedConvs,
    });
  });

  // Step 3: Group conversations without workspace by timeline
  const withoutWorkspaceByTimeline = new Map<string, TChatConversation[]>();

  withoutWorkspaceConvs.forEach((conv) => {
    const timeline = getConversationTimelineLabel(conv, t);
    if (!withoutWorkspaceByTimeline.has(timeline)) {
      withoutWorkspaceByTimeline.set(timeline, []);
    }
    withoutWorkspaceByTimeline.get(timeline)!.push(conv);
  });

  // Step 4: Build sections in timeline order
  const timelineOrder = ['conversation.history.today', 'conversation.history.yesterday', 'conversation.history.recent7Days', 'conversation.history.earlier'];
  const sections: TimelineSection[] = [];

  timelineOrder.forEach((timelineKey) => {
    const timeline = t(timelineKey);
    const withWorkspace = workspaceGroupsByTimeline.get(timeline) || [];
    const withoutWorkspace = withoutWorkspaceByTimeline.get(timeline) || [];

    // Only add section if this timeline has conversations
    if (withWorkspace.length === 0 && withoutWorkspace.length === 0) return;

    // Merge workspace groups and standalone conversations into a unified items array
    const items: TimelineItem[] = [];

    // Add workspace group items
    withWorkspace.forEach((group) => {
      const updateTime = getWorkspaceUpdateTime(group.workspace);
      const time = updateTime > 0 ? updateTime : getActivityTime(group.conversations[0]);
      items.push({
        type: 'workspace',
        time,
        workspaceGroup: group,
      });
    });

    // Add standalone conversation items
    withoutWorkspace.forEach((conv) => {
      items.push({
        type: 'conversation',
        time: getActivityTime(conv),
        conversation: conv,
      });
    });

    // Sort all items by time (most recent first)
    items.sort((a, b) => b.time - a.time);

    sections.push({
      timeline,
      items,
    });
  });

  return sections;
};

const EXPANSION_STORAGE_KEY = 'foundry_workspace_expansion';

const WorkspaceGroupedHistory: React.FC<{ onSessionClick?: () => void; collapsed?: boolean }> = ({ onSessionClick, collapsed = false }) => {
  const [conversations, setConversations] = useState<TChatConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<string[]>(() => {
    // Restore expansion state from localStorage
    try {
      const stored = localStorage.getItem(EXPANSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // Ignore errors
    }
    return [];
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openTab, closeAllTabs, activeTab, updateTabName } = useConversationTabs();
  const { getJobStatus, markAsRead } = useCronJobsMap();

  // Load conversation list
  useEffect(() => {
    const refresh = () => {
      ipcBridge.database.getUserConversations
        .invoke({ page: 0, pageSize: 10000 })
        .then((data) => {
          if (data && Array.isArray(data)) {
            setConversations(data);
          } else {
            setConversations([]);
          }
        })
        .catch((error) => {
          console.error('[WorkspaceGroupedHistory] Failed to load conversations:', error);
          setConversations([]);
        });
    };
    refresh();
    return addEventListener('chat.history.refresh', refresh);
  }, []);

  // Scroll to active conversation when route changes
  useEffect(() => {
    if (!id) return;
    // Use requestAnimationFrame to ensure DOM is updated
    const rafId = requestAnimationFrame(() => {
      const element = document.getElementById('c-' + id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [id]);

  // Persist expansion state
  useEffect(() => {
    try {
      localStorage.setItem(EXPANSION_STORAGE_KEY, JSON.stringify(expandedWorkspaces));
    } catch {
      // Ignore errors
    }
  }, [expandedWorkspaces]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.name.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  // Group by timeline and workspace
  const timelineSections = useMemo(() => {
    return groupConversationsByTimelineAndWorkspace(filteredConversations, t);
  }, [filteredConversations, t]);

  // Expand all workspaces on first load (only if localStorage had no saved state)
  const hasInitializedExpansion = useRef(false);
  useEffect(() => {
    if (hasInitializedExpansion.current) return;
    // Only auto-expand if no saved state exists (empty array from init, not from user collapsing all)
    const hasSavedState = localStorage.getItem(EXPANSION_STORAGE_KEY) !== null;
    if (hasSavedState) {
      hasInitializedExpansion.current = true;
      return;
    }
    const allWorkspaces: string[] = [];
    timelineSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.type === 'workspace' && item.workspaceGroup) {
          allWorkspaces.push(item.workspaceGroup.workspace);
        }
      });
    });
    if (allWorkspaces.length > 0) {
      setExpandedWorkspaces(allWorkspaces);
      hasInitializedExpansion.current = true;
    }
  }, [timelineSections]);

  const handleConversationClick = useCallback(
    (conv: TChatConversation) => {
      const customWorkspace = conv.extra?.customWorkspace;
      const newWorkspace = conv.extra?.workspace;

      // Mark conversation as read (clear unread cron execution indicator)
      markAsRead(conv.id);

      // If clicked conversation is not in a custom workspace, close all tabs
      if (!customWorkspace) {
        closeAllTabs();
        void navigate(`/conversation/${conv.id}`);
        if (onSessionClick) {
          onSessionClick();
        }
        return;
      }

      // If clicked conversation is in a custom workspace
      // Check if current active tab's workspace is different from the new conversation's workspace
      const currentWorkspace = activeTab?.workspace;

      // If there's no active tab, or workspace is different, close all tabs before opening new tab
      if (!currentWorkspace || currentWorkspace !== newWorkspace) {
        closeAllTabs();
      }

      // Open new conversation's tab
      openTab(conv);
      void navigate(`/conversation/${conv.id}`);
      if (onSessionClick) {
        onSessionClick();
      }
    },
    [openTab, closeAllTabs, activeTab, navigate, onSessionClick, markAsRead]
  );

  // Toggle workspace expand/collapse state
  const handleToggleWorkspace = useCallback((workspace: string) => {
    setExpandedWorkspaces((prev) => {
      if (prev.includes(workspace)) {
        return prev.filter((w) => w !== workspace);
      } else {
        return [...prev, workspace];
      }
    });
  }, []);

  const handleRemoveConversation = useCallback(
    (convId: string) => {
      void ipcBridge.conversation.remove
        .invoke({ id: convId })
        .then((success) => {
          if (success) {
            // Trigger conversation deletion event to close corresponding tab
            emitter.emit('conversation.deleted', convId);
            // Refresh conversation list
            emitter.emit('chat.history.refresh');
            if (id === convId) {
              void navigate('/');
            }
          }
        })
        .catch((error) => {
          console.error('Failed to remove conversation:', error);
        });
    },
    [id, navigate]
  );

  const handleEditStart = useCallback((conversation: TChatConversation) => {
    setEditingId(conversation.id);
    setEditingName(conversation.name);
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingId || !editingName.trim()) return;

    try {
      const success = await ipcBridge.conversation.update.invoke({
        id: editingId,
        updates: { name: editingName.trim() },
      });

      if (success) {
        updateTabName(editingId, editingName.trim());
        emitter.emit('chat.history.refresh');
      }
    } catch (error) {
      console.error('Failed to update conversation name:', error);
    } finally {
      setEditingId(null);
      setEditingName('');
    }
  }, [editingId, editingName, updateTabName]);

  const handleEditCancel = useCallback(() => {
    setEditingId(null);
    setEditingName('');
  }, []);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        void handleEditSave();
      } else if (e.key === 'Escape') {
        handleEditCancel();
      }
    },
    [handleEditSave, handleEditCancel]
  );

  const renderConversation = useCallback(
    (conversation: TChatConversation) => {
      const isSelected = id === conversation.id;
      const isEditing = editingId === conversation.id;
      const cronStatus = getJobStatus(conversation.id);

      return (
        <Tooltip key={conversation.id} disabled={!collapsed} content={conversation.name || t('conversation.welcome.newConversation')} position='right'>
          <div
            id={'c-' + conversation.id}
            className={classNames('chat-history__item hover:bg-hover px-12px py-8px rd-8px flex justify-start items-center group cursor-pointer relative overflow-hidden shrink-0 conversation-item [&.conversation-item+&.conversation-item]:mt-2px min-w-0', {
              '!bg-active': isSelected,
            })}
            onClick={() => handleConversationClick(conversation)}
          >
            {cronStatus !== 'none' ? <CronJobIndicator status={cronStatus} size={20} className='flex-shrink-0' /> : <MessageOne theme='outline' size='20' className='line-height-0 flex-shrink-0' />}
            <FlexFullContainer className='h-24px min-w-0 flex-1 collapsed-hidden ml-10px'>{isEditing ? <Input className='chat-history__item-editor text-14px lh-24px h-24px w-full' value={editingName} onChange={setEditingName} onKeyDown={handleEditKeyDown} onBlur={handleEditSave} autoFocus size='small' /> : <div className='chat-history__item-name overflow-hidden text-ellipsis inline-block flex-1 text-14px lh-24px whitespace-nowrap min-w-0'>{conversation.name}</div>}</FlexFullContainer>
            {!isEditing && (
              <div
                className={classNames('absolute right-0px top-0px h-full w-40px items-center justify-end hidden group-hover:flex !collapsed-hidden pr-8px')}
                style={{
                  backgroundImage: isSelected ? `linear-gradient(to right, transparent, var(--aou-2) 50%)` : `linear-gradient(to right, transparent, var(--aou-1) 50%)`,
                }}
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <ConversationContextMenu conversation={conversation} onRename={() => handleEditStart(conversation)} />
              </div>
            )}
          </div>
        </Tooltip>
      );
    },
    [id, collapsed, editingId, editingName, t, handleConversationClick, handleEditStart, handleEditKeyDown, handleEditSave, handleRemoveConversation, getJobStatus]
  );

  // If there are no conversations, show empty state
  if (timelineSections.length === 0) {
    return (
      <FlexFullContainer>
        <div className='flex-center'>
          <Empty description={t('conversation.history.noHistory')} />
        </div>
      </FlexFullContainer>
    );
  }

  return (
    <FlexFullContainer>
      <div className='size-full overflow-y-auto overflow-x-hidden'>
        {!collapsed && <ConversationSearch onSearch={handleSearch} />}
        {searchQuery && filteredConversations.length === 0 ? <div className='px-12px py-16px text-13px text-t-secondary text-center'>{t('conversation.history.noResults', { defaultValue: 'No conversations found' })}</div> : null}
        {timelineSections.map((section) => (
          <div key={section.timeline} className='mb-8px min-w-0'>
            {/* Timeline title */}
            {!collapsed && <div className='chat-history__section px-12px py-8px text-13px text-t-secondary font-bold'>{section.timeline}</div>}

            {/* Render all items sorted by time (workspace groups and standalone conversations mixed) */}
            {section.items.map((item) => {
              if (item.type === 'workspace' && item.workspaceGroup) {
                const group = item.workspaceGroup;
                return (
                  <div key={group.workspace} className={classNames('min-w-0', { 'px-8px': !collapsed })}>
                    <WorkspaceCollapse
                      expanded={expandedWorkspaces.includes(group.workspace)}
                      onToggle={() => handleToggleWorkspace(group.workspace)}
                      siderCollapsed={collapsed}
                      header={
                        <div className='flex items-center gap-8px text-14px min-w-0'>
                          <span className='font-medium truncate flex-1 text-t-primary min-w-0'>{group.displayName}</span>
                        </div>
                      }
                    >
                      <div className={classNames('flex flex-col gap-2px min-w-0', { 'mt-4px': !collapsed })}>{group.conversations.map((conv) => renderConversation(conv))}</div>
                    </WorkspaceCollapse>
                  </div>
                );
              } else if (item.type === 'conversation' && item.conversation) {
                return renderConversation(item.conversation);
              }
              return null;
            })}
          </div>
        ))}
      </div>
    </FlexFullContainer>
  );
};

export default WorkspaceGroupedHistory;
