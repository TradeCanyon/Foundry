/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProjectsPage — Grid page showing all projects with search and sort.
 * Route: /projects
 */

import { ipcBridge } from '@/common';
import type { IProjectInfo } from '@/common/ipcBridge';
import ProjectCard from '@/renderer/components/ProjectCard';
import { emitter } from '@/renderer/utils/emitter';
import { FolderPlus, Plus, Search } from '@icon-park/react';
import { Button, Empty, Input } from '@arco-design/web-react';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import ProjectWizard from '@/renderer/components/ProjectWizard';

type SortMode = 'activity' | 'name' | 'created';

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('activity');
  const [wizardVisible, setWizardVisible] = useState(false);

  const { data: projectsData } = useSWR('projects-list', () => ipcBridge.project.list.invoke());
  const projects = ((projectsData?.success ? projectsData.data : []) || []) as IProjectInfo[];

  const filtered = useMemo(() => {
    let result = projects.filter((p) => !p.archived);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }

    if (sortMode === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === 'created') {
      result.sort((a, b) => b.created - a.created);
    } else {
      result.sort((a, b) => b.lastActive - a.lastActive);
    }

    return result;
  }, [projects, searchQuery, sortMode]);

  return (
    <div className='size-full flex flex-col p-24px overflow-y-auto'>
      {/* Header */}
      <div className='flex items-center justify-between mb-20px'>
        <h1 className='text-22px font-600' style={{ color: 'var(--text-primary)' }}>
          Projects
        </h1>
        <Button type='primary' size='small' icon={<Plus theme='outline' size='14' fill='white' />} onClick={() => setWizardVisible(true)}>
          New Project
        </Button>
      </div>

      {/* Search + sort */}
      <div className='flex items-center gap-12px mb-16px'>
        <Input prefix={<Search theme='outline' size='14' />} placeholder='Search projects...' value={searchQuery} onChange={setSearchQuery} allowClear style={{ maxWidth: '300px' }} />
        <div className='flex items-center gap-2px'>
          {(['activity', 'name', 'created'] as SortMode[]).map((mode) => (
            <div
              key={mode}
              className='px-10px py-4px rd-12px cursor-pointer text-12px'
              style={{
                backgroundColor: sortMode === mode ? 'var(--bg-3)' : 'transparent',
                color: sortMode === mode ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontWeight: sortMode === mode ? 600 : 400,
              }}
              onClick={() => setSortMode(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className='flex-center flex-col gap-12px py-48px'>
          <Empty
            description={
              searchQuery ? (
                'No projects found'
              ) : (
                <span>
                  No projects yet.{' '}
                  <span className='cursor-pointer' style={{ color: '#ff6b35' }} onClick={() => setWizardVisible(true)}>
                    Create one
                  </span>{' '}
                  to organize your conversations.
                </span>
              )
            }
          />
        </div>
      ) : (
        <div className='grid gap-12px' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {filtered.map((p) => (
            <ProjectCard
              key={p.workspace}
              project={p}
              onClick={() => void navigate(`/projects/${encodeURIComponent(p.workspace)}`)}
              onArchive={() => {
                void ipcBridge.project.archive.invoke({ workspace: p.workspace }).then((): void => void mutate('projects-list'));
              }}
              onDelete={() => {
                void ipcBridge.project.remove.invoke({ workspace: p.workspace }).then((): void => void mutate('projects-list'));
              }}
            />
          ))}
        </div>
      )}

      <ProjectWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onCreated={(workspace) => {
          void mutate('projects-list');
          void navigate(`/projects/${encodeURIComponent(workspace)}`);
        }}
      />
    </div>
  );
};

export default ProjectsPage;
