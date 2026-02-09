/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/storage';
import type { IProjectInfo } from '@/common/ipcBridge';
import FlexFullContainer from '@/renderer/components/FlexFullContainer';
import ConversationContextMenu from '@/renderer/components/ConversationContextMenu';
import SearchOverlay from '@/renderer/components/SearchOverlay';
import { SidebarNav, SidebarStarredSection, SidebarProjectsSection, SidebarRecentsSection } from '@/renderer/components/sidebar';
import { CronJobIndicator, useCronJobsMap } from '@/renderer/pages/cron';
import { addEventListener, emitter } from '@/renderer/utils/emitter';
import { getActivityTime } from '@/renderer/utils/timeline';
import { getConversationAgentLogo } from '@/renderer/utils/agentLogos';
import { ArrowCircleLeft, MessageOne, Pic, SettingTwo } from '@icon-park/react';
import { Input, Tooltip } from '@arco-design/web-react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import SettingsSider from './pages/settings/SettingsSider';
import { usePreviewContext } from './pages/conversation/preview';
import { useConversationTabs } from './pages/conversation/context/ConversationTabsContext';
import ProjectWizard from './components/ProjectWizard';
import { iconColors } from './theme/colors';

const SECTION_STORAGE_KEY = 'foundry_sidebar_sections';

interface SiderProps {
  onSessionClick?: () => void;
  collapsed?: boolean;
}

const Sider: React.FC<SiderProps> = ({ onSessionClick, collapsed = false }) => {
  const location = useLocation();
  const { pathname, search, hash } = location;
  const { id: activeConvId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { closePreview } = usePreviewContext();
  const { openTab, closeAllTabs, activeTab, updateTabName } = useConversationTabs();
  const { getJobStatus, markAsRead } = useCronJobsMap();
  const isSettings = pathname.startsWith('/settings');
  const lastNonSettingsPathRef = useRef('/guid');

  // State
  const [wizardVisible, setWizardVisible] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [conversations, setConversations] = useState<TChatConversation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [sectionStates, setSectionStates] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(SECTION_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Data
  const { data: projectsData, mutate: refreshProjects } = useSWR('sidebar-projects', () => ipcBridge.project.list.invoke());
  const projects = useMemo(() => ((projectsData?.success ? projectsData.data : []) || []) as IProjectInfo[], [projectsData]);

  // Track last non-settings path
  useEffect(() => {
    if (!pathname.startsWith('/settings')) {
      lastNonSettingsPathRef.current = `${pathname}${search}${hash}`;
    }
  }, [pathname, search, hash]);

  // Load conversations
  useEffect(() => {
    const refresh = () => {
      ipcBridge.database.getUserConversations
        .invoke({ page: 0, pageSize: 10000 })
        .then((data) => setConversations(Array.isArray(data) ? data : []))
        .catch(() => setConversations([]));
    };
    refresh();
    return addEventListener('chat.history.refresh', refresh);
  }, []);

  // Persist section collapse states
  useEffect(() => {
    try {
      localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(sectionStates));
    } catch {
      // Ignore
    }
  }, [sectionStates]);

  // Scroll to active conversation
  useEffect(() => {
    if (!activeConvId) return;
    const rafId = requestAnimationFrame(() => {
      document.getElementById('c-' + activeConvId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => cancelAnimationFrame(rafId);
  }, [activeConvId]);

  // Global Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleToggleSection = useCallback((key: string) => {
    setSectionStates((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));
  }, []);

  // Derive conversation groups
  const { starredConversations, recentConversations } = useMemo(() => {
    const starred: TChatConversation[] = [];
    const recent: TChatConversation[] = [];

    for (const conv of conversations) {
      const extra = (conv.extra || {}) as Record<string, unknown>;
      if (extra.starred === true) {
        starred.push(conv);
      } else {
        recent.push(conv);
      }
    }

    starred.sort((a, b) => getActivityTime(b) - getActivityTime(a));
    recent.sort((a, b) => getActivityTime(b) - getActivityTime(a));

    return { starredConversations: starred, recentConversations: recent };
  }, [conversations]);

  // Handlers
  const handleConversationClick = useCallback(
    (conv: TChatConversation) => {
      markAsRead(conv.id);
      const customWorkspace = conv.extra?.customWorkspace;
      const newWorkspace = conv.extra?.workspace;

      if (!customWorkspace) {
        closeAllTabs();
        void navigate(`/conversation/${conv.id}`);
        onSessionClick?.();
        return;
      }

      const currentWorkspace = activeTab?.workspace;
      if (!currentWorkspace || currentWorkspace !== newWorkspace) {
        closeAllTabs();
      }
      openTab(conv);
      void navigate(`/conversation/${conv.id}`);
      onSessionClick?.();
    },
    [openTab, closeAllTabs, activeTab, navigate, onSessionClick, markAsRead]
  );

  const handleRemoveConversation = useCallback(
    (convId: string) => {
      void ipcBridge.conversation.remove
        .invoke({ id: convId })
        .then((success) => {
          if (success) {
            emitter.emit('conversation.deleted', convId);
            emitter.emit('chat.history.refresh');
            if (activeConvId === convId) void navigate('/');
          }
        })
        .catch(console.error);
    },
    [activeConvId, navigate]
  );

  const handleEditStart = useCallback((conv: TChatConversation) => {
    setEditingId(conv.id);
    setEditingName(conv.name);
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingId || !editingName.trim()) return;
    try {
      const success = await ipcBridge.conversation.update.invoke({ id: editingId, updates: { name: editingName.trim() } });
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
      if (e.key === 'Enter') void handleEditSave();
      else if (e.key === 'Escape') handleEditCancel();
    },
    [handleEditSave, handleEditCancel]
  );

  const handleSettingsClick = () => {
    if (isSettings) {
      void navigate(lastNonSettingsPathRef.current || '/guid');
    } else {
      void navigate('/settings/gemini');
    }
    onSessionClick?.();
  };

  // Render a single conversation item (with agent logo)
  const renderConversation = useCallback(
    (conversation: TChatConversation) => {
      const isSelected = activeConvId === conversation.id;
      const isEditing = editingId === conversation.id;
      const cronStatus = getJobStatus(conversation.id);
      const isImage = conversation.type === 'image';
      const agentLogo = getConversationAgentLogo(conversation);

      return (
        <Tooltip key={conversation.id} disabled={!collapsed} content={conversation.name || t('conversation.welcome.newConversation')} position='right'>
          <div
            id={'c-' + conversation.id}
            className={classNames('hover:bg-hover px-8px py-6px rd-6px flex items-center group cursor-pointer relative overflow-hidden shrink-0 min-w-0', {
              '!bg-active': isSelected,
            })}
            onClick={() => handleConversationClick(conversation)}
          >
            {/* Agent logo or fallback icon */}
            {cronStatus !== 'none' ? <CronJobIndicator status={cronStatus} size={16} className='flex-shrink-0' /> : agentLogo ? <img src={agentLogo} alt='' width={14} height={14} style={{ objectFit: 'contain', flexShrink: 0 }} /> : isImage ? <Pic theme='outline' size='14' className='line-height-0 flex-shrink-0' fill={iconColors.secondary} /> : conversation.type === 'ember' ? <span style={{ fontSize: 12, lineHeight: '14px', flexShrink: 0 }}>{'\u{1F525}'}</span> : <MessageOne theme='outline' size='14' className='line-height-0 flex-shrink-0' />}
            <FlexFullContainer className='h-22px min-w-0 flex-1 collapsed-hidden ml-8px'>{isEditing ? <Input className='text-13px lh-22px h-22px w-full' value={editingName} onChange={setEditingName} onKeyDown={handleEditKeyDown} onBlur={handleEditSave} autoFocus size='small' /> : <div className='overflow-hidden text-ellipsis text-13px lh-22px whitespace-nowrap min-w-0'>{conversation.name}</div>}</FlexFullContainer>
            {!isEditing && (
              <div
                className='absolute right-0px top-0px h-full w-36px items-center justify-end hidden group-hover:flex collapsed-hidden pr-4px'
                style={{
                  backgroundImage: isSelected ? `linear-gradient(to right, transparent, var(--aou-2) 50%)` : `linear-gradient(to right, transparent, var(--aou-1) 50%)`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <ConversationContextMenu conversation={conversation} onRename={() => handleEditStart(conversation)} projects={projects} />
              </div>
            )}
          </div>
        </Tooltip>
      );
    },
    [activeConvId, collapsed, editingId, editingName, t, handleConversationClick, handleEditStart, handleEditKeyDown, handleEditSave, getJobStatus, projects]
  );

  return (
    <div className='size-full flex flex-col'>
      {/* Main content area */}
      <div className='flex-1 min-h-0 overflow-hidden'>
        {isSettings ? (
          <SettingsSider collapsed={collapsed} />
        ) : (
          <div className='size-full flex flex-col'>
            {/* Top nav */}
            <SidebarNav collapsed={collapsed} onSessionClick={onSessionClick} onNewProject={() => setWizardVisible(true)} onSearchOpen={() => setSearchOpen(true)} />

            {/* Divider */}
            <div className='mx-12px my-4px' style={{ height: '1px', backgroundColor: 'var(--bg-3)' }} />

            {/* Scrollable sections */}
            <FlexFullContainer>
              <div className='size-full overflow-y-auto overflow-x-hidden'>
                {starredConversations.length > 0 && <SidebarStarredSection conversations={starredConversations} collapsed={collapsed} renderConversation={renderConversation} sectionStates={sectionStates} onToggleSection={handleToggleSection} />}

                {projects.length > 0 && <SidebarProjectsSection projects={projects} collapsed={collapsed} onSessionClick={onSessionClick} sectionStates={sectionStates} onToggleSection={handleToggleSection} />}

                <SidebarRecentsSection conversations={recentConversations} collapsed={collapsed} renderConversation={renderConversation} sectionStates={sectionStates} onToggleSection={handleToggleSection} onSessionClick={onSessionClick} />
              </div>
            </FlexFullContainer>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className='shrink-0 sider-footer'>
        <Tooltip disabled={!collapsed} content={isSettings ? t('common.back') : t('common.settings')} position='right'>
          <div onClick={handleSettingsClick} className='flex items-center justify-start gap-10px px-12px py-8px hover:bg-hover rd-0.5rem mb-8px cursor-pointer'>
            {isSettings ? <ArrowCircleLeft className='flex' theme='outline' size='24' fill={iconColors.primary} /> : <SettingTwo className='flex' theme='outline' size='24' fill={iconColors.primary} />}
            <span className='collapsed-hidden text-t-primary'>{isSettings ? t('common.back') : t('common.settings')}</span>
          </div>
        </Tooltip>
      </div>

      <ProjectWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onCreated={(workspace) => {
          void refreshProjects();
          void navigate('/guid', { state: { workspace } });
        }}
      />

      <SearchOverlay visible={searchOpen} onClose={() => setSearchOpen(false)} projects={projects} />
    </div>
  );
};

export default Sider;
