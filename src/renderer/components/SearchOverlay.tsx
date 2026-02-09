/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SearchOverlay — Ctrl+K spotlight search across conversations, projects, and memory.
 */

import { ipcBridge } from '@/common';
import type { IProjectInfo, IMemorySearchResult } from '@/common/ipcBridge';
import type { TChatConversation } from '@/common/storage';
import { getConversationAgentLogo } from '@/renderer/utils/agentLogos';
import { Search, MessageOne, FolderOpen, DataSheet, Pic } from '@icon-park/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type SearchOverlayProps = {
  visible: boolean;
  onClose: () => void;
  projects?: IProjectInfo[];
};

type SearchResult = {
  id: string;
  type: 'conversation' | 'project' | 'memory';
  title: string;
  snippet?: string;
  timestamp?: number;
  logo?: string | null;
  navigateTo: string;
};

const SearchOverlay: React.FC<SearchOverlayProps> = ({ visible, onClose, projects }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when visible
  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [visible]);

  // Global Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (visible) onClose();
        // Opening is handled by the parent
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, onClose]);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const [convResults, memoryResults] = await Promise.all([ipcBridge.database.searchConversations.invoke({ query: q, limit: 10 }), ipcBridge.memory.search.invoke({ query: q }).catch(() => [] as IMemorySearchResult[])]);

        const allResults: SearchResult[] = [];

        // Conversations
        for (const conv of convResults) {
          allResults.push({
            id: conv.id,
            type: 'conversation',
            title: conv.name,
            timestamp: conv.modifyTime || conv.createTime,
            logo: getConversationAgentLogo(conv),
            navigateTo: `/conversation/${conv.id}`,
          });
        }

        // Projects (client-side filter)
        if (projects) {
          const lq = q.toLowerCase();
          for (const p of projects) {
            if (p.name.toLowerCase().includes(lq) || p.description?.toLowerCase().includes(lq)) {
              allResults.push({
                id: `project:${p.workspace}`,
                type: 'project',
                title: p.name,
                snippet: p.description,
                timestamp: p.lastActive,
                navigateTo: `/projects/${encodeURIComponent(p.workspace)}`,
              });
            }
          }
        }

        // Memory
        for (const mem of memoryResults.slice(0, 5)) {
          allResults.push({
            id: `memory:${mem.id}`,
            type: 'memory',
            title: mem.content.slice(0, 80) + (mem.content.length > 80 ? '...' : ''),
            snippet: mem.type,
            timestamp: mem.createdAt,
            navigateTo: '/settings/memory',
          });
        }

        setResults(allResults);
        setActiveIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [projects]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void doSearch(val), 200);
    },
    [doSearch]
  );

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onClose();
      void navigate(result.navigateTo);
    },
    [navigate, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && results[activeIndex]) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
      }
    },
    [results, activeIndex, handleSelect, onClose]
  );

  const formatTimeAgo = (ts?: number) => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (!visible) return null;

  return (
    <div className='fixed inset-0 z-1000 flex items-start justify-center pt-[15vh]' style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        style={{
          width: '560px',
          maxHeight: '60vh',
          backgroundColor: 'var(--bg-1)',
          borderRadius: '12px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          border: '1px solid var(--bg-3)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className='flex items-center gap-10px px-16px py-12px' style={{ borderBottom: '1px solid var(--bg-3)' }}>
          <Search theme='outline' size='18' style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder='Search conversations, projects, memory...'
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '15px',
            }}
          />
          <kbd className='text-11px px-6px py-2px rd-4px' style={{ backgroundColor: 'var(--bg-2)', color: 'var(--text-tertiary)', border: '1px solid var(--bg-3)' }}>
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 'calc(60vh - 56px)', overflowY: 'auto' }}>
          {loading && (
            <div className='px-16px py-12px text-13px' style={{ color: 'var(--text-tertiary)' }}>
              Searching...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className='px-16px py-20px text-13px text-center' style={{ color: 'var(--text-tertiary)' }}>
              No results found
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className='py-4px'>
              {results.map((result, i) => (
                <div
                  key={result.id}
                  className='flex items-center gap-10px px-16px py-8px cursor-pointer'
                  style={{
                    backgroundColor: i === activeIndex ? 'var(--bg-2)' : 'transparent',
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => handleSelect(result)}
                >
                  {/* Icon */}
                  <div className='flex-shrink-0 w-20px h-20px flex items-center justify-center'>{result.type === 'conversation' && result.logo ? <img src={result.logo} alt='' width={16} height={16} style={{ objectFit: 'contain' }} /> : result.type === 'conversation' ? <MessageOne theme='outline' size='16' /> : result.type === 'project' ? <FolderOpen theme='outline' size='16' /> : <DataSheet theme='outline' size='16' />}</div>
                  {/* Content */}
                  <div className='flex-1 min-w-0'>
                    <div className='text-13px truncate' style={{ color: 'var(--text-primary)' }}>
                      {result.title}
                    </div>
                    {result.snippet && (
                      <div className='text-11px truncate' style={{ color: 'var(--text-tertiary)' }}>
                        {result.snippet}
                      </div>
                    )}
                  </div>
                  {/* Time */}
                  <div className='text-11px flex-shrink-0' style={{ color: 'var(--text-tertiary)' }}>
                    {formatTimeAgo(result.timestamp)}
                  </div>
                  {/* Type badge */}
                  <div className='text-10px px-4px py-1px rd-4px flex-shrink-0' style={{ backgroundColor: 'var(--bg-3)', color: 'var(--text-tertiary)' }}>
                    {result.type === 'conversation' ? 'Chat' : result.type === 'project' ? 'Project' : 'Memory'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!query && (
            <div className='px-16px py-20px text-center'>
              <div className='text-13px' style={{ color: 'var(--text-tertiary)' }}>
                Type to search across all your conversations, projects, and memories
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchOverlay;
