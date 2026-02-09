/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SendBoxSettingsPopover — Gear icon popover in the SendBox toolbar.
 * Shows quick toggles for Subagents, MCPs, and Project Settings link.
 * Inspired by MiniMax Agent's settings menu.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

type SubagentItem = {
  key: string;
  label: string;
  enabled: boolean;
};

type McpItem = {
  key: string;
  label: string;
  icon?: string;
  enabled: boolean;
};

type SendBoxSettingsPopoverProps = {
  subagents?: SubagentItem[];
  mcps?: McpItem[];
  onSubagentToggle?: (key: string, enabled: boolean) => void;
  onMcpToggle?: (key: string, enabled: boolean) => void;
  onManageSubagents?: () => void;
  onManageMcps?: () => void;
  onProjectSettings?: () => void;
};

// Simple toggle switch component
const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void }> = ({ enabled, onChange }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onChange(!enabled);
    }}
    className='relative inline-flex items-center rd-full cursor-pointer transition-colors duration-200 b-none p-0'
    style={{
      width: '36px',
      height: '20px',
      backgroundColor: enabled ? '#ff6b35' : 'var(--bg-3)',
    }}
  >
    <span
      className='inline-block rd-full bg-white transition-transform duration-200'
      style={{
        width: '16px',
        height: '16px',
        transform: enabled ? 'translateX(18px)' : 'translateX(2px)',
      }}
    />
  </button>
);

type MenuView = 'main' | 'subagents' | 'mcps';

const SendBoxSettingsPopover: React.FC<SendBoxSettingsPopoverProps> = ({ subagents = [], mcps = [], onSubagentToggle, onMcpToggle, onManageSubagents, onManageMcps, onProjectSettings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<MenuView>('main');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setView('main');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view !== 'main') {
          setView('main');
        } else {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, view]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) setView('main');
      return !prev;
    });
  }, []);

  const menuItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    cursor: 'pointer',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    width: '100%',
    textAlign: 'left',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'background-color 0.1s',
  };

  const renderMainMenu = () => (
    <div className='flex flex-col gap-2px p-6px'>
      <button style={menuItemStyle} onClick={() => setView('subagents')} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
        <span className='text-16px'>{'\u2699\uFE0F'}</span>
        <span className='flex-1'>Subagent</span>
        <span className='text-16px opacity-40'>{'\u203A'}</span>
      </button>
      <button style={menuItemStyle} onClick={() => setView('mcps')} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
        <span className='text-16px'>{'\u{1F50C}'}</span>
        <span className='flex-1'>MCP</span>
        <span className='text-16px opacity-40'>{'\u203A'}</span>
      </button>
      <button
        style={menuItemStyle}
        onClick={() => {
          onProjectSettings?.();
          setIsOpen(false);
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span className='text-16px'>{'\u2699'}</span>
        <span className='flex-1'>Project Settings</span>
      </button>
    </div>
  );

  const renderSubagentMenu = () => (
    <div className='flex flex-col gap-2px p-6px'>
      <button style={{ ...menuItemStyle, padding: '8px 14px' }} onClick={() => setView('main')} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
        <span className='text-14px'>{'\u2039'}</span>
      </button>
      <div className='px-14px py-4px text-11px font-600 text-t-tertiary uppercase tracking-wider'>Built-In</div>
      {subagents.length === 0 && <div className='px-14px py-8px text-12px text-t-tertiary'>No subagents configured</div>}
      {subagents.map((agent) => (
        <div key={agent.key} className='flex items-center justify-between px-14px py-8px'>
          <span className='text-13px font-500' style={{ color: 'var(--text-primary)' }}>
            {agent.label}
          </span>
          <ToggleSwitch enabled={agent.enabled} onChange={(enabled) => onSubagentToggle?.(agent.key, enabled)} />
        </div>
      ))}
      <div className='b-t-1 b-solid b-border-2 mt-4px pt-4px'>
        <button
          style={{ ...menuItemStyle, color: 'var(--text-secondary)' }}
          onClick={() => {
            onManageSubagents?.();
            setIsOpen(false);
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Manage Subagents
        </button>
      </div>
    </div>
  );

  const renderMcpMenu = () => (
    <div className='flex flex-col gap-2px p-6px'>
      <button style={{ ...menuItemStyle, padding: '8px 14px' }} onClick={() => setView('main')} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
        <span className='text-14px'>{'\u2039'}</span>
      </button>
      {mcps.length === 0 && <div className='px-14px py-8px text-12px text-t-tertiary'>No MCPs connected</div>}
      {mcps.map((mcp) => (
        <div key={mcp.key} className='flex items-center justify-between px-14px py-8px'>
          <div className='flex items-center gap-8px'>
            {mcp.icon && <span className='text-14px'>{mcp.icon}</span>}
            <span className='text-13px font-500' style={{ color: 'var(--text-primary)' }}>
              {mcp.label}
            </span>
          </div>
          <ToggleSwitch enabled={mcp.enabled} onChange={(enabled) => onMcpToggle?.(mcp.key, enabled)} />
        </div>
      ))}
      <div className='b-t-1 b-solid b-border-2 mt-4px pt-4px'>
        <button
          style={{ ...menuItemStyle, color: 'var(--text-secondary)' }}
          onClick={() => {
            onManageMcps?.();
            setIsOpen(false);
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Manage MCP
        </button>
      </div>
    </div>
  );

  return (
    <div ref={popoverRef} className='relative'>
      {/* Trigger button */}
      <button
        onClick={toggleOpen}
        className='flex items-center justify-center w-28px h-28px rd-full b-none cursor-pointer transition-all duration-150'
        style={{
          backgroundColor: isOpen ? 'var(--bg-3)' : 'transparent',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = 'var(--bg-2)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = 'transparent';
        }}
        title='Settings'
      >
        <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <line x1='4' y1='21' x2='4' y2='14' />
          <line x1='4' y1='10' x2='4' y2='3' />
          <line x1='12' y1='21' x2='12' y2='12' />
          <line x1='12' y1='8' x2='12' y2='3' />
          <line x1='20' y1='21' x2='20' y2='16' />
          <line x1='20' y1='12' x2='20' y2='3' />
          <line x1='1' y1='14' x2='7' y2='14' />
          <line x1='9' y1='8' x2='15' y2='8' />
          <line x1='17' y1='16' x2='23' y2='16' />
        </svg>
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          className='absolute z-100 rd-10px overflow-hidden'
          style={{
            bottom: 'calc(100% + 8px)',
            left: '0',
            minWidth: '220px',
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--bg-3)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          }}
        >
          {view === 'main' && renderMainMenu()}
          {view === 'subagents' && renderSubagentMenu()}
          {view === 'mcps' && renderMcpMenu()}
        </div>
      )}
    </div>
  );
};

export default SendBoxSettingsPopover;
