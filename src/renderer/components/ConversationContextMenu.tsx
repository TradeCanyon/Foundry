/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ConversationContextMenu — Three-dot dropdown for conversation items.
 * Replaces hover edit/delete icons with a richer menu.
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/storage';
import { emitter } from '@/renderer/utils/emitter';
import { DeleteOne, EditOne, Download, MoreOne, FolderPlus } from '@icon-park/react';
import { Message } from '@arco-design/web-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export interface ConversationContextMenuProps {
  conversation: TChatConversation;
  onRename: () => void;
}

const ConversationContextMenu: React.FC<ConversationContextMenuProps> = ({ conversation, onRename }) => {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isProject, setIsProject] = useState<boolean | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const workspace = conversation.extra?.workspace as string | undefined;

  // Check if workspace is already a project when menu opens
  useEffect(() => {
    if (!open || !workspace) {
      setIsProject(null);
      return;
    }
    void ipcBridge.project.detect.invoke({ workspace }).then(setIsProject);
  }, [open, workspace]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmingDelete(false);
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
    },
    [open]
  );

  const handleRename = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(false);
      onRename();
    },
    [onRename]
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

  const handlePromoteToProject = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!workspace) return;
      setOpen(false);
      try {
        const result = await ipcBridge.project.init.invoke({
          workspace,
          name: conversation.name || 'Untitled Project',
          description: `Promoted from conversation`,
          type: 'workspace',
          goals: [],
        });
        if (result.success) {
          Message.success('Project created from conversation');
          setIsProject(true);
        } else {
          Message.error(result.msg || 'Failed to create project');
        }
      } catch {
        Message.error('Failed to create project');
      }
    },
    [workspace, conversation.name]
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
            minWidth: '160px',
          }}
        >
          <div style={menuItemStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')} onClick={handleRename}>
            <EditOne theme='outline' size='16' />
            <span>{t('conversation.history.rename', { defaultValue: 'Rename' })}</span>
          </div>

          <div style={menuItemStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')} onClick={(e) => void handleExport('md', e)}>
            <Download theme='outline' size='16' />
            <span>{t('conversation.history.exportMd', { defaultValue: 'Export Markdown' })}</span>
          </div>

          <div style={menuItemStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')} onClick={(e) => void handleExport('json', e)}>
            <Download theme='outline' size='16' />
            <span>{t('conversation.history.exportJson', { defaultValue: 'Export JSON' })}</span>
          </div>

          {/* Promote to Project — only show if workspace exists and isn't already a project */}
          {workspace && isProject === false && (
            <div style={menuItemStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')} onClick={(e) => void handlePromoteToProject(e)}>
              <FolderPlus theme='outline' size='16' />
              <span>Promote to Project</span>
            </div>
          )}

          <div style={dividerStyle} />

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
