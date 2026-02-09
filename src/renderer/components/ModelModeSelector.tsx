/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ModelModeSelector — Icon buttons for quick model routing modes.
 * Inspired by MiniMax Agent's Air/Custom/Pro mode selector.
 *
 * Modes:
 * - Lightning — fast, efficient model for most tasks
 * - Custom (gears) — user-configured model selection
 * - Pro (multi-agent) — multi-agent for complex tasks, deep research
 */

import React, { useState } from 'react';

export type ModelMode = 'auto' | 'air' | 'custom' | 'pro';

type ModelModeDef = {
  key: ModelMode;
  label: string;
  description: string;
  icon: React.ReactNode;
};

const MODE_DEFS: ModelModeDef[] = [
  {
    key: 'air',
    label: 'Lightning',
    description: 'High efficiency and speed for most tasks',
    icon: (
      <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M13 2L3 14h9l-1 8 10-12h-9l1-8z' />
      </svg>
    ),
  },
  {
    key: 'custom',
    label: 'Custom',
    description: 'Build your own way with custom capabilities',
    icon: (
      <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
        <circle cx='12' cy='12' r='3' />
        <path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' />
      </svg>
    ),
  },
  {
    key: 'pro',
    label: 'Pro',
    description: 'Multi-agent for complex development, deep research',
    icon: (
      <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
        <circle cx='9' cy='7' r='4' />
        <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
        <path d='M16 3.13a4 4 0 0 1 0 7.75' />
      </svg>
    ),
  },
];

type ModelModeSelectorProps = {
  mode: ModelMode;
  onModeChange: (mode: ModelMode) => void;
};

const ModelModeSelector: React.FC<ModelModeSelectorProps> = ({ mode, onModeChange }) => {
  const [hoveredMode, setHoveredMode] = useState<ModelMode | null>(null);

  return (
    <div className='flex items-center gap-2px'>
      {MODE_DEFS.map((def) => {
        const isActive = mode === def.key;
        const isHovered = hoveredMode === def.key;

        return (
          <div key={def.key} className='relative'>
            <button
              onClick={() => onModeChange(isActive ? 'auto' : def.key)}
              onMouseEnter={() => setHoveredMode(def.key)}
              onMouseLeave={() => setHoveredMode(null)}
              className='flex items-center justify-center w-28px h-28px rd-6px b-none cursor-pointer transition-all duration-150'
              style={{
                backgroundColor: isActive ? 'var(--bg-3)' : 'transparent',
                color: isActive ? '#ff6b35' : 'var(--text-tertiary)',
              }}
              title={`${def.label}: ${def.description}`}
            >
              {def.icon}
            </button>

            {/* Tooltip */}
            {isHovered && !isActive && (
              <div
                className='absolute z-100 rd-8px px-12px py-8px pointer-events-none'
                style={{
                  bottom: 'calc(100% + 8px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  minWidth: '180px',
                  backgroundColor: 'var(--bg-1)',
                  border: '1px solid var(--bg-3)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                }}
              >
                <div className='text-13px font-600 mb-2px' style={{ color: 'var(--text-primary)' }}>
                  {def.label}
                </div>
                <div className='text-11px lh-16px' style={{ color: 'var(--text-secondary)' }}>
                  {def.description}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ModelModeSelector;
