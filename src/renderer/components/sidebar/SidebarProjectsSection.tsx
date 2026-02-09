/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SidebarProjectsSection — Shows recent projects (max 3, expandable).
 * Hidden when no projects exist.
 */

import type { IProjectInfo } from '@/common/ipcBridge';
import { FolderOpen } from '@icon-park/react';
import { Tooltip } from '@arco-design/web-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

type SidebarProjectsSectionProps = {
  projects: IProjectInfo[];
  collapsed: boolean;
  onSessionClick?: () => void;
  sectionStates: Record<string, boolean>;
  onToggleSection: (key: string) => void;
};

const SidebarProjectsSection: React.FC<SidebarProjectsSectionProps> = ({ projects, collapsed, onSessionClick, sectionStates, onToggleSection }) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const isCollapsed = sectionStates['projects'] === false;

  if (projects.length === 0) return null;

  const sorted = [...projects].sort((a, b) => b.lastActive - a.lastActive);
  const visibleCount = expanded ? Math.min(sorted.length, 10) : 3;
  const visible = sorted.slice(0, visibleCount);
  const hasMore = sorted.length > 3 && !expanded;

  return (
    <div className='mb-2px'>
      {!collapsed && (
        <div className='flex items-center gap-6px px-12px pt-8px pb-4px cursor-pointer select-none' onClick={() => onToggleSection('projects')}>
          <FolderOpen theme='outline' size='12' />
          <span className='text-11px font-700 text-t-tertiary uppercase tracking-wider flex-1'>Projects</span>
          <span className='text-10px text-t-tertiary'>{projects.length}</span>
        </div>
      )}
      {!isCollapsed && (
        <div className='flex flex-col gap-1px px-4px'>
          {visible.map((project) => {
            const typeColor = PROJECT_TYPE_COLORS[project.type] || PROJECT_TYPE_COLORS.workspace;
            return (
              <Tooltip key={project.workspace} disabled={!collapsed} content={project.name} position='right'>
                <div
                  className='flex items-center gap-6px px-8px py-5px hover:bg-hover rd-6px cursor-pointer min-w-0'
                  style={{ borderLeft: `3px solid ${typeColor}` }}
                  onClick={() => {
                    void navigate(`/projects/${encodeURIComponent(project.workspace)}`);
                    onSessionClick?.();
                  }}
                >
                  <FolderOpen theme='outline' size='14' fill={typeColor} className='flex-shrink-0' />
                  <span className='collapsed-hidden text-13px truncate flex-1 min-w-0' style={{ color: 'var(--text-primary)' }}>
                    {project.name}
                  </span>
                </div>
              </Tooltip>
            );
          })}
          {hasMore && !collapsed && (
            <div
              className='px-12px py-3px text-11px text-t-tertiary cursor-pointer hover:text-t-secondary'
              onClick={() => {
                if (sorted.length > 10) {
                  void navigate('/projects');
                  onSessionClick?.();
                } else {
                  setExpanded(true);
                }
              }}
            >
              View all ({projects.length})
            </div>
          )}
          {expanded && !collapsed && (
            <div className='px-12px py-3px text-11px text-t-tertiary cursor-pointer hover:text-t-secondary' onClick={() => setExpanded(false)}>
              Show less
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SidebarProjectsSection;
