/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ConversationContextMenu — Three-dot dropdown for conversation items.
 * Supports: Star, Rename, Move to Project, Remove from Project, Export, Delete.
 */

import { ipcBridge } from '@/common';
import type { IProjectInfo } from '@/common/ipcBridge';
import type { TChatConversation } from '@/common/storage';
import { emitter } from '@/renderer/utils/emitter';
import { DeleteOne, EditOne, Download, MoreOne, FolderPlus, FolderMinus, Star } from '@icon-park/react';
import { Message } from '@arco-design/web-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export interface ConversationContextMenuProps {
  conversation: TChatConversation;
  onRename: () => void;
  projects?: IProjectInfo[];
}

const ConversationContextMenu: React.FC<ConversationContextMenuProps> = ({ conversation, onRename, projects }) => {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const extra = (conversation.extra || {}) as Record<string, unknown>;
  const isStarred = extra.starred === true;
  const workspace = extra.workspace as string | undefined;
  const isInProject = extra.customWorkspace === true && !!workspace;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmingDelete(false);
        setShowProjectPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setConfirmingDelete(false);
        setShowProjectPicker(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(!open);
      setConfirmingDelete(false);
      setShowProjectPicker(false);
    },
    [open]
  );

  const handleStar = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(false);
      try {
        const newStarred = !isStarred;
        await ipcBridge.conversation.update.invoke({
          id: conversation.id,
          updates: { extra: { starred: newStarred } } as any,
          mergeExtra: true,
        });
        emitter.emit('chat.history.refresh');
        Message.info({ content: newStarred ? 'Starred' : 'Unstarred' });
      } catch {
        Message.error('Failed to update');
      }
    },
    [conversation.id, isStarred]
  );

  const handleRename = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(false);
      onRename();
    },
    [onRename]
  );

  const handleMoveToProject = useCallback(
    async (targetWorkspace: string) => {
      const prevWorkspace = workspace;
      const prevCustom = extra.customWorkspace;
      try {
        await ipcBridge.conversation.update.invoke({
          id: conversation.id,
          updates: { extra: { workspace: targetWorkspace, customWorkspace: true } } as any,
          mergeExtra: true,
        });
        emitter.emit('chat.history.refresh');
        setOpen(false);
        setShowProjectPicker(false);

        const undoTimeout = setTimeout(() => {}, 0);
        clearTimeout(undoTimeout);

        Message.info({
          content: (
            <span>
              Moved to project.{' '}
              <b
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={async () => {
                  try {
                    await ipcBridge.conversation.update.invoke({
                      id: conversation.id,
                      updates: { extra: { workspace: prevWorkspace || '', customWorkspace: !!prevCustom } } as any,
                      mergeExtra: true,
                    });
                    emitter.emit('chat.history.refresh');
                    Message.info({ content: 'Undone' });
                  } catch {
                    Message.error('Undo failed');
                  }
                }}
              >
                Undo
              </b>
            </span>
          ),
          duration: 5000,
        });
      } catch {
        Message.error('Failed to move');
      }
    },
    [conversation.id, workspace, extra.customWorkspace]
  );

  const handleRemoveFromProject = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const prevWorkspace = workspace;
      try {
        await ipcBridge.conversation.update.invoke({
          id: conversation.id,
          updates: { extra: { workspace: '', customWorkspace: false } } as any,
          mergeExtra: true,
        });
        emitter.emit('chat.history.refresh');
        setOpen(false);

        Message.info({
          content: (
            <span>
              Removed from project.{' '}
              <b
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={async () => {
                  try {
                    await ipcBridge.conversation.update.invoke({
                      id: conversation.id,
                      updates: { extra: { workspace: prevWorkspace, customWorkspace: true } } as any,
                      mergeExtra: true,
                    });
                    emitter.emit('chat.history.refresh');
                    Message.info({ content: 'Undone' });
                  } catch {
                    Message.error('Undo failed');
                  }
                }}
              >
                Undo
              </b>
            </span>
          ),
          duration: 5000,
        });
      } catch {
        Message.error('Failed to remove');
      }
    },
    [conversation.id, workspace]
  );

  const handleExport = useCallback(
    async (format: 'md' | 'json', e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(false);
      try {
        const messages = await ipcBridge.database.getConversationMessages.invoke({
          conversation_id: conversation.id,
          page: 0,
          pageSize: 100000,
        });

        let content: string;
        let filename: string;
        const safeName = conversation.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);

        if (format === 'json') {
          content = JSON.stringify({ conversation, messages }, null, 2);
          filename = `${safeName}.json`;
        } else {
          const lines = [`# ${conversation.name}`, '', `*Exported from Foundry — ${new Date().toISOString()}*`, ''];
          for (const msg of messages || []) {
            const role = msg.position === 'right' ? 'User' : 'Assistant';
            lines.push(`## ${role}`, '');
            const text = typeof msg.content === 'string' ? msg.content : (msg.content as { content?: string })?.content || JSON.stringify(msg.content);
            lines.push(text, '');
          }
          content = lines.join('\n');
          filename = `${safeName}.md`;
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('[ConversationContextMenu] Export failed:', error);
      }
    },
    [conversation]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirmingDelete) {
        setConfirmingDelete(true);
        return;
      }
      setOpen(false);
      setConfirmingDelete(false);
      void ipcBridge.conversation.remove
        .invoke({ id: conversation.id })
        .then((success) => {
          if (success) {
            emitter.emit('chat.history.refresh');
            void Promise.resolve(navigate('/')).catch(console.error);
          }
        })
        .catch(console.error);
    },
    [conversation.id, confirmingDelete, navigate]
  );

  const menuItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
  };

  const dividerStyle: React.CSSProperties = {
    height: '1px',
    backgroundColor: 'var(--bg-3)',
    margin: '4px 0',
  };

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <span
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: '2px',
          borderRadius: '4px',
        }}
      >
        <MoreOne theme='outline' size='18' />
      </span>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: '4px',
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--bg-3)',
            borderRadius: '8px',
            padding: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999,
            minWidth: '180px',
          }}
        >
          {/* Star / Unstar */}
          <div style={menuItemStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')} onClick={(e) => void handleStar(e)}>
            <Star theme={isStarred ? 'filled' : 'outline'} size='16' fill={isStarred ? '#f59e0b' : undefined} />
            <span>{isStarred ? 'Unstar' : 'Star'}</span>
          </div>

          {/* Rename */}
          <div style={menuItemStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')} onClick={handleRename}>
            <EditOne theme='outline' size='16' />
            <span>{t('conversation.history.rename', { defaultValue: 'Rename' })}</span>
          </div>

          {/* Move to Project / Change Project */}
          {projects && projects.length > 0 && (
            <div>
              <div
                style={menuItemStyle}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProjectPicker(!showProjectPicker);
                }}
              >
                <FolderPlus theme='outline' size='16' />
                <span>{isInProject ? 'Change Project' : 'Move to Project'}</span>
              </div>
              {showProjectPicker && (
                <div style={{ padding: '2px 4px', maxHeight: '150px', overflowY: 'auto' }}>
                  {projects.map((p) => (
                    <div
                      key={p.workspace}
                      style={{
                        ...menuItemStyle,
                        padding: '4px 12px 4px 28px',
                        fontSize: '12px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleMoveToProject(p.workspace);
                      }}
                    >
                      <FolderPlus theme='outline' size='14' />
                      <span className='truncate' style={{ maxWidth: '140px' }}>
                        {p.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Remove from Project */}
          {isInProject && (
            <div style={menuItemStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')} onClick={(e) => void handleRemoveFromProject(e)}>
              <FolderMinus theme='outline' size='16' />
              <span>Remove from Project</span>
            </div>
          )}

          <div style={dividerStyle} />

          {/* Export */}
          <div style={menuItemStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')} onClick={(e) => void handleExport('md', e)}>
            <Download theme='outline' size='16' />
            <span>{t('conversation.history.exportMd', { defaultValue: 'Export Markdown' })}</span>
          </div>

          <div style={menuItemStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')} onClick={(e) => void handleExport('json', e)}>
            <Download theme='outline' size='16' />
            <span>{t('conversation.history.exportJson', { defaultValue: 'Export JSON' })}</span>
          </div>

          <div style={dividerStyle} />

          {/* Delete */}
          <div
            style={{
              ...menuItemStyle,
              color: confirmingDelete ? '#ef4444' : 'var(--text-primary)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = confirmingDelete ? 'rgba(239,68,68,0.1)' : 'var(--bg-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            onClick={handleDelete}
          >
            <DeleteOne theme='outline' size='16' fill={confirmingDelete ? '#ef4444' : undefined} />
            <span>{confirmingDelete ? t('conversation.history.confirmDelete', { defaultValue: 'Click again to confirm' }) : t('conversation.history.deleteTitle', { defaultValue: 'Delete' })}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationContextMenu;
