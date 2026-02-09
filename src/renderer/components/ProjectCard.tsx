/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProjectCard — Displays project summary in a card format for the home page grid.
 */

import type { IProjectInfo } from '@/common/ipcBridge';
import React, { useState } from 'react';

const TYPE_COLORS: Record<string, string> = {
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

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

type ProjectCardProps = {
  project: IProjectInfo;
  chatCount?: number;
  onClick: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
};

const ProjectCard: React.FC<ProjectCardProps> = ({ project, chatCount = 0, onClick, onArchive, onDelete }) => {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const typeColor = TYPE_COLORS[project.type] || TYPE_COLORS.workspace;

  return (
    <div
      className='relative rd-12px cursor-pointer transition-all duration-200 p-16px'
      style={{
        backgroundColor: 'var(--bg-1)',
        border: '1px solid var(--bg-3)',
        boxShadow: hovered ? '0 4px 16px rgba(0, 0, 0, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.04)',
        transform: hovered ? 'translateY(-1px)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setMenuOpen(false);
      }}
      onClick={onClick}
    >
      {/* Header: Name + menu */}
      <div className='flex items-start justify-between mb-8px'>
        <h3 className='text-15px font-600 m-0 overflow-hidden text-ellipsis' style={{ color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
          {project.name}
        </h3>

        {/* Three-dot menu */}
        {hovered && (
          <button
            className='flex items-center justify-center w-24px h-24px rd-6px b-none cursor-pointer flex-shrink-0'
            style={{ backgroundColor: menuOpen ? 'var(--bg-3)' : 'transparent', color: 'var(--text-secondary)' }}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
          >
            <svg width='14' height='14' viewBox='0 0 24 24' fill='currentColor'>
              <circle cx='12' cy='5' r='2' />
              <circle cx='12' cy='12' r='2' />
              <circle cx='12' cy='19' r='2' />
            </svg>
          </button>
        )}
      </div>

      {/* Description */}
      <p className='text-12px lh-18px m-0 mb-12px overflow-hidden text-ellipsis' style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {project.description || 'No description'}
      </p>

      {/* Footer: Type badge + metadata */}
      <div className='flex items-center justify-between'>
        <span className='text-11px font-500 px-8px py-2px rd-4px' style={{ backgroundColor: `${typeColor}18`, color: typeColor }}>
          {project.type}
        </span>
        <div className='flex items-center gap-8px text-11px' style={{ color: 'var(--text-tertiary)' }}>
          {chatCount > 0 && <span>{chatCount} chats</span>}
          <span>{timeAgo(project.lastActive)}</span>
        </div>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          className='absolute z-50 rd-8px py-4px overflow-hidden'
          style={{
            top: '44px',
            right: '8px',
            minWidth: '140px',
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--bg-3)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          }}
        >
          {onArchive && (
            <button
              className='flex items-center gap-8px w-full px-12px py-8px b-none bg-transparent cursor-pointer text-13px text-left'
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
                setMenuOpen(false);
              }}
            >
              Archive
            </button>
          )}
          {onDelete && (
            <button
              className='flex items-center gap-8px w-full px-12px py-8px b-none bg-transparent cursor-pointer text-13px text-left'
              style={{ color: '#ef4444' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
                setMenuOpen(false);
              }}
            >
              Delete Project
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectCard;
