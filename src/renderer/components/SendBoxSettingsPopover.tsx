/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SendBoxSettingsPopover — Gear icon popover in the SendBox toolbar.
 * Shows MCP server status and quick links to settings.
 * Self-contained: loads MCP data via useMcpServers hook.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMcpServers } from '@/renderer/hooks/mcp/useMcpServers';

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

type MenuView = 'main' | 'mcps';

const SendBoxSettingsPopover: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<MenuView>('main');
  const popoverRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { mcpServers, saveMcpServers } = useMcpServers();

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

  const handleMcpToggle = useCallback(
    (serverName: string, enabled: boolean) => {
      void saveMcpServers((prev) => prev.map((s) => (s.name === serverName ? { ...s, enabled } : s)));
    },
    [saveMcpServers]
  );

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

  const enabledCount = mcpServers.filter((s) => s.enabled !== false).length;

  const renderMainMenu = () => (
    <div className='flex flex-col gap-2px p-6px'>
      <button style={menuItemStyle} onClick={() => setView('mcps')} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
        <span className='text-16px'>{'\u{1F50C}'}</span>
        <span className='flex-1'>MCP Servers</span>
        {mcpServers.length > 0 && (
          <span className='text-11px text-t-tertiary'>
            {enabledCount}/{mcpServers.length}
          </span>
        )}
        <span className='text-16px opacity-40'>{'\u203A'}</span>
      </button>
      <button
        style={menuItemStyle}
        onClick={() => {
          void navigate('/settings/tools');
          setIsOpen(false);
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span className='text-16px'>{'\u2699'}</span>
        <span className='flex-1'>Tool Settings</span>
      </button>
      <button
        style={menuItemStyle}
        onClick={() => {
          void navigate('/settings/agent');
          setIsOpen(false);
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span className='text-16px'>{'\u{1F916}'}</span>
        <span className='flex-1'>Assistants</span>
      </button>
    </div>
  );

  const renderMcpMenu = () => (
    <div className='flex flex-col gap-2px p-6px'>
      <button style={{ ...menuItemStyle, padding: '8px 14px' }} onClick={() => setView('main')} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
        <span className='text-14px'>{'\u2039'}</span>
        <span className='text-13px font-500'>MCP Servers</span>
      </button>
      {mcpServers.length === 0 && (
        <div className='px-14px py-8px text-12px text-t-tertiary'>
          No MCP servers configured.{' '}
          <span
            className='text-[rgb(var(--primary-6))] cursor-pointer'
            onClick={() => {
              void navigate('/settings/tools');
              setIsOpen(false);
            }}
          >
            Add one
          </span>
        </div>
      )}
      {mcpServers.map((server) => (
        <div key={server.name} className='flex items-center justify-between px-14px py-8px'>
          <span className='text-13px font-500 truncate max-w-140px' style={{ color: 'var(--text-primary)' }} title={server.name}>
            {server.name}
          </span>
          <ToggleSwitch enabled={server.enabled !== false} onChange={(enabled) => handleMcpToggle(server.name, enabled)} />
        </div>
      ))}
      <div className='b-t-1 b-solid b-border-2 mt-4px pt-4px'>
        <button
          style={{ ...menuItemStyle, color: 'var(--text-secondary)' }}
          onClick={() => {
            void navigate('/settings/tools');
            setIsOpen(false);
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Manage MCP Servers
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
          {view === 'mcps' && renderMcpMenu()}
        </div>
      )}
    </div>
  );
};

export default SendBoxSettingsPopover;
