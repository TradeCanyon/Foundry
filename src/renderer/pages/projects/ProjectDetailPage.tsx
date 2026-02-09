/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProjectDetailPage — Workspace-like detail page for a project.
 * Shows conversations, instructions, reference materials.
 * Route: /projects/:workspace
 */

import { ipcBridge } from '@/common';
import type { IProjectInfo, IDirOrFile } from '@/common/ipcBridge';
import type { TChatConversation } from '@/common/storage';
import { getConversationAgentLogo } from '@/renderer/utils/agentLogos';
import { getActivityTime } from '@/renderer/utils/timeline';
import { addEventListener } from '@/renderer/utils/emitter';
import { ArrowLeft, FolderOpen, MessageOne, Pic, Plus } from '@icon-park/react';
import { Button, Empty, Input, Message } from '@arco-design/web-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';

const PROJECT_TYPE_COLORS: Record<string, string> = {
  software: '#3b82f6',
  web: '#22c55e',
  content: '#f59e0b',
  marketing: '#ec4899',
  business: '#8b5cf6',
  creative: '#f97316',
  data: '#06b6d4',
  devops: '#64748b',
  other: '#a78bfa',
  workspace: '#94a3b8',
};

const ProjectDetailPage: React.FC = () => {
  const { workspace: encodedWorkspace } = useParams<{ workspace: string }>();
  const workspace = encodedWorkspace ? decodeURIComponent(encodedWorkspace) : '';
  const navigate = useNavigate();

  const [instructions, setInstructions] = useState('');
  const [instructionsEditing, setInstructionsEditing] = useState(false);
  const [conversations, setConversations] = useState<TChatConversation[]>([]);
  const [refFiles, setRefFiles] = useState<IDirOrFile[]>([]);

  // Load project info
  const { data: projectData } = useSWR(workspace ? `project:${workspace}` : null, () => ipcBridge.project.read.invoke({ workspace }));
  const project = (projectData?.success ? projectData.data : null) as IProjectInfo | null;

  // Load conversations
  useEffect(() => {
    if (!workspace) return;
    const refresh = () => {
      ipcBridge.project.getConversations
        .invoke({ workspace })
        .then((data) => setConversations(Array.isArray(data) ? data : []))
        .catch(() => setConversations([]));
    };
    refresh();
    const cleanup = addEventListener('chat.history.refresh', refresh);
    return cleanup;
  }, [workspace]);

  // Load instructions
  useEffect(() => {
    if (!workspace) return;
    ipcBridge.fs.readFile
      .invoke({ path: `${workspace}/.foundry/instructions.md` })
      .then((content) => setInstructions(content || ''))
      .catch(() => setInstructions(''));
  }, [workspace]);

  // Load reference files
  useEffect(() => {
    if (!workspace) return;
    ipcBridge.fs.getFilesByDir
      .invoke({ dir: '.foundry', root: workspace })
      .then((files) => setRefFiles(files.filter((f) => f.isFile && f.name !== 'project.json' && f.name !== 'instructions.md')))
      .catch(() => setRefFiles([]));
  }, [workspace]);

  const sortedConversations = useMemo(() => [...conversations].sort((a, b) => getActivityTime(b) - getActivityTime(a)), [conversations]);

  // Activity stats
  const recentCount = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return conversations.filter((c) => getActivityTime(c) > weekAgo).length;
  }, [conversations]);

  const handleSaveInstructions = useCallback(async () => {
    try {
      await ipcBridge.fs.writeFile.invoke({
        path: `${workspace}/.foundry/instructions.md`,
        data: instructions,
      });
      setInstructionsEditing(false);
      Message.success('Instructions saved');
    } catch {
      Message.error('Failed to save instructions');
    }
  }, [workspace, instructions]);

  const formatTimeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const typeColor = PROJECT_TYPE_COLORS[project?.type || 'workspace'] || PROJECT_TYPE_COLORS.workspace;

  if (!workspace) {
    return (
      <div className='flex-center size-full'>
        <Empty description='No project selected' />
      </div>
    );
  }

  return (
    <div className='size-full flex flex-col'>
      {/* Header */}
      <div className='shrink-0 px-24px py-16px flex items-center gap-12px' style={{ borderBottom: '1px solid var(--bg-3)' }}>
        <div className='flex items-center gap-8px cursor-pointer text-t-secondary hover:text-t-primary' onClick={() => void navigate('/projects')}>
          <ArrowLeft theme='outline' size='16' />
          <span className='text-13px'>Projects</span>
        </div>
        <div className='w-1px h-16px' style={{ backgroundColor: 'var(--bg-3)' }} />
        <FolderOpen theme='outline' size='18' fill={typeColor} />
        <span className='text-16px font-600' style={{ color: 'var(--text-primary)' }}>
          {project?.name || workspace.split(/[/\\]/).pop()}
        </span>
        {project?.type && (
          <div className='text-11px px-6px py-1px rd-4px' style={{ backgroundColor: typeColor + '20', color: typeColor }}>
            {project.type}
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className='flex-1 flex min-h-0'>
        {/* Left column: Description, actions, conversations */}
        <div className='flex-1 overflow-y-auto p-24px'>
          {/* Description */}
          {project?.description && (
            <p className='text-13px mb-16px lh-20px' style={{ color: 'var(--text-secondary)' }}>
              {project.description}
            </p>
          )}

          {/* Quick actions */}
          <div className='flex items-center gap-8px mb-24px'>
            <Button type='primary' size='small' icon={<Plus theme='outline' size='14' fill='white' />} onClick={() => void navigate('/guid', { state: { workspace } })}>
              New Chat
            </Button>
            <Button
              size='small'
              onClick={() =>
                void ipcBridge.shell.showItemInFolder.invoke(workspace).catch(() => {
                  Message.error('Failed to open folder');
                })
              }
            >
              Open Folder
            </Button>
          </div>

          {/* Conversations */}
          <div>
            <h2 className='text-14px font-600 mb-10px' style={{ color: 'var(--text-primary)' }}>
              Conversations
            </h2>
            {sortedConversations.length === 0 ? (
              <div className='py-16px text-13px text-center' style={{ color: 'var(--text-tertiary)' }}>
                No conversations yet.{' '}
                <span className='cursor-pointer' style={{ color: '#ff6b35' }} onClick={() => void navigate('/guid', { state: { workspace } })}>
                  Start one
                </span>
              </div>
            ) : (
              <div className='flex flex-col gap-2px'>
                {sortedConversations.map((conv) => {
                  const agentLogo = getConversationAgentLogo(conv);
                  const isImage = conv.type === 'image';

                  return (
                    <div key={conv.id} className='flex items-center gap-10px px-12px py-8px rd-8px cursor-pointer hover:bg-hover' onClick={() => void navigate(`/conversation/${conv.id}`)}>
                      <div className='flex-shrink-0 w-18px h-18px flex items-center justify-center'>{agentLogo ? <img src={agentLogo} alt='' width={15} height={15} style={{ objectFit: 'contain' }} /> : isImage ? <Pic theme='outline' size='15' /> : conv.type === 'ember' ? <span style={{ fontSize: 13 }}>{'\u{1F525}'}</span> : <MessageOne theme='outline' size='15' />}</div>
                      <div className='flex-1 min-w-0 truncate text-13px' style={{ color: 'var(--text-primary)' }}>
                        {conv.name}
                      </div>
                      <div className='text-11px flex-shrink-0' style={{ color: 'var(--text-tertiary)' }}>
                        {formatTimeAgo(getActivityTime(conv))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Knowledge cards */}
        <div className='w-320px shrink-0 overflow-y-auto p-20px' style={{ borderLeft: '1px solid var(--bg-3)' }}>
          {/* Instructions card */}
          <div className='mb-20px'>
            <div className='flex items-center justify-between mb-8px'>
              <h3 className='text-13px font-600 m-0' style={{ color: 'var(--text-primary)' }}>
                Instructions
              </h3>
              {instructionsEditing ? (
                <div className='flex gap-6px'>
                  <Button size='mini' onClick={() => setInstructionsEditing(false)}>
                    Cancel
                  </Button>
                  <Button size='mini' type='primary' onClick={() => void handleSaveInstructions()}>
                    Save
                  </Button>
                </div>
              ) : (
                <Button size='mini' onClick={() => setInstructionsEditing(true)}>
                  Edit
                </Button>
              )}
            </div>
            {instructionsEditing ? (
              <Input.TextArea autoSize={{ minRows: 4, maxRows: 16 }} value={instructions} onChange={setInstructions} placeholder='Instructions for AI agents working in this project...' style={{ fontSize: '13px' }} />
            ) : (
              <div
                className='rd-8px p-12px text-13px whitespace-pre-wrap'
                style={{
                  backgroundColor: 'var(--bg-2)',
                  color: instructions ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  minHeight: '60px',
                }}
              >
                {instructions || 'No instructions yet. Click Edit to add project-level instructions for AI agents.'}
              </div>
            )}
          </div>

          {/* Files card */}
          <div className='mb-20px'>
            <div className='flex items-center justify-between mb-8px'>
              <h3 className='text-13px font-600 m-0' style={{ color: 'var(--text-primary)' }}>
                Files
              </h3>
              <Button
                size='mini'
                onClick={() => {
                  void ipcBridge.dialog.showOpen.invoke({ properties: ['openFile', 'multiSelections'] }).then((selected) => {
                    if (selected && selected.length > 0) {
                      void ipcBridge.fs.copyFilesToWorkspace
                        .invoke({ filePaths: selected, workspace: `${workspace}/.foundry` })
                        .then(() => {
                          ipcBridge.fs.getFilesByDir
                            .invoke({ dir: '.foundry', root: workspace })
                            .then((files) => setRefFiles(files.filter((f) => f.isFile && f.name !== 'project.json' && f.name !== 'instructions.md')))
                            .catch(() => {});
                        })
                        .catch(() => Message.error('Failed to add files'));
                    }
                  });
                }}
              >
                Add
              </Button>
            </div>
            {refFiles.length === 0 ? (
              <div className='text-12px py-8px' style={{ color: 'var(--text-tertiary)' }}>
                No reference files. Add files to .foundry/ for AI context.
              </div>
            ) : (
              <div className='flex flex-col gap-4px'>
                {refFiles.map((file) => (
                  <div key={file.fullPath} className='flex items-center gap-6px px-10px py-6px rd-6px cursor-pointer hover:bg-hover' style={{ border: '1px solid var(--bg-3)' }} onClick={() => void ipcBridge.shell.openFile.invoke(file.fullPath)}>
                    <span className='text-13px'>&#x1F4C4;</span>
                    <span className='text-12px flex-1 truncate' style={{ color: 'var(--text-primary)' }}>
                      {file.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity card */}
          <div>
            <h3 className='text-13px font-600 mb-8px m-0' style={{ color: 'var(--text-primary)' }}>
              Activity
            </h3>
            <div className='flex flex-col gap-8px'>
              <div className='flex items-center justify-between text-13px'>
                <span style={{ color: 'var(--text-secondary)' }}>Total conversations</span>
                <span className='font-600' style={{ color: 'var(--text-primary)' }}>
                  {conversations.length}
                </span>
              </div>
              <div className='flex items-center justify-between text-13px'>
                <span style={{ color: 'var(--text-secondary)' }}>Active this week</span>
                <span className='font-600' style={{ color: recentCount > 0 ? '#ff6b35' : 'var(--text-primary)' }}>
                  {recentCount}
                </span>
              </div>
              {project?.created && (
                <div className='flex items-center justify-between text-13px'>
                  <span style={{ color: 'var(--text-secondary)' }}>Created</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{new Date(project.created).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;
