/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * MemoryModalContent — Memory management UI in Settings.
 *
 * Shows:
 * - Memory stats (total, project, global, profile entries)
 * - User profile entries (category/key/value with confidence)
 * - Recent memories (searchable)
 * - Actions: delete individual, clear profile, clear workspace
 */

import { ipcBridge } from '@/common';
import type { IMemorySearchResult, IMemoryStats, IUserProfileInfo } from '@/common/ipcBridge';
import React, { useCallback, useEffect, useState } from 'react';

const MemoryModalContent: React.FC = () => {
  const [stats, setStats] = useState<IMemoryStats | null>(null);
  const [profile, setProfile] = useState<IUserProfileInfo[]>([]);
  const [memories, setMemories] = useState<IMemorySearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResult, profileResult, memoriesResult] = await Promise.all([ipcBridge.memory.getStats.invoke({}), ipcBridge.memory.getProfile.invoke(), searchQuery ? ipcBridge.memory.search.invoke({ query: searchQuery }) : ipcBridge.memory.list.invoke({ limit: 20 })]);
      setStats(statsResult);
      setProfile(profileResult);
      setMemories(memoriesResult);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDeleteMemory = useCallback(
    async (id: string) => {
      await ipcBridge.memory.remove.invoke({ memoryId: id });
      void loadData();
    },
    [loadData]
  );

  const handleDeleteProfile = useCallback(
    async (id: string) => {
      await ipcBridge.memory.removeProfile.invoke({ entryId: id });
      void loadData();
    },
    [loadData]
  );

  const handleClearProfile = useCallback(async () => {
    if (!confirm('Clear all learned preferences? This cannot be undone.')) return;
    await ipcBridge.memory.clearProfile.invoke();
    void loadData();
  }, [loadData]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void loadData();
    },
    [loadData]
  );

  return (
    <div className='flex flex-col gap-24px p-4px'>
      {/* Header */}
      <div>
        <h3 className='text-16px font-600 text-t-primary m-0 mb-4px'>Persistent Memory</h3>
        <p className='text-13px text-t-secondary m-0'>Foundry learns from your conversations and remembers across sessions. All data is stored locally.</p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className='grid grid-cols-4 gap-12px'>
          <StatCard label='Total' value={stats.totalMemories} />
          <StatCard label='Project' value={stats.projectMemories} />
          <StatCard label='Global' value={stats.globalMemories} />
          <StatCard label='Profile' value={stats.profileEntries} />
        </div>
      )}

      {/* User Profile section */}
      <div>
        <div className='flex items-center justify-between mb-8px'>
          <h4 className='text-14px font-600 text-t-primary m-0'>User Profile</h4>
          {profile.length > 0 && (
            <button className='text-12px text-t-secondary hover:text-red-500 cursor-pointer bg-transparent b-none px-8px py-4px rd-4px hover:bg-fill-2 transition-colors' onClick={handleClearProfile}>
              Clear All
            </button>
          )}
        </div>
        {profile.length === 0 ? (
          <p className='text-13px text-t-tertiary m-0'>No preferences learned yet. Foundry will learn from your conversations over time.</p>
        ) : (
          <div className='flex flex-col gap-4px'>
            {profile.map((entry) => (
              <div key={entry.id} className='flex items-center gap-8px px-12px py-8px bg-fill-1 rd-6px text-13px group'>
                <span className='text-t-secondary min-w-80px shrink-0 font-500'>{entry.category}</span>
                <span className='text-t-primary font-500'>{entry.key}:</span>
                <span className='text-t-secondary flex-1'>{entry.value}</span>
                <span className='text-11px text-t-tertiary shrink-0' title={`Confidence: ${Math.round(entry.confidence * 100)}%, Evidence: ${entry.evidenceCount}`}>
                  {Math.round(entry.confidence * 100)}%
                </span>
                <button className='text-t-tertiary hover:text-red-500 cursor-pointer bg-transparent b-none opacity-0 group-hover:opacity-100 transition-opacity text-12px' onClick={() => handleDeleteProfile(entry.id)} title='Delete this preference'>
                  {'\u00D7'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Memories section */}
      <div>
        <div className='flex items-center justify-between mb-8px'>
          <h4 className='text-14px font-600 text-t-primary m-0'>Memories</h4>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className='mb-12px'>
          <input type='text' value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder='Search memories...' className='w-full px-12px py-8px rd-6px b-1 b-solid b-color-border-2 bg-fill-1 text-t-primary text-13px outline-none focus:b-brand' />
        </form>

        {loading ? (
          <p className='text-13px text-t-tertiary m-0'>Loading...</p>
        ) : memories.length === 0 ? (
          <p className='text-13px text-t-tertiary m-0'>{searchQuery ? 'No memories match your search.' : 'No memories stored yet. They will appear after your first conversations.'}</p>
        ) : (
          <div className='flex flex-col gap-6px max-h-300px overflow-y-auto'>
            {memories.map((mem) => (
              <div key={mem.id} className='px-12px py-10px bg-fill-1 rd-6px text-13px group'>
                <div className='flex items-start justify-between gap-8px'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-6px mb-4px'>
                      <span
                        className='text-11px font-500 px-6px py-1px rd-4px'
                        style={{
                          backgroundColor: TYPE_COLORS[mem.type] ?? 'var(--color-fill-2)',
                          color: 'var(--color-text-1)',
                        }}
                      >
                        {mem.type.replace(/_/g, ' ')}
                      </span>
                      <span className='text-11px text-t-tertiary'>{timeAgo(mem.createdAt)}</span>
                      {mem.workspace && (
                        <span className='text-11px text-t-tertiary truncate max-w-150px' title={mem.workspace}>
                          {mem.workspace.split(/[/\\]/).pop()}
                        </span>
                      )}
                    </div>
                    <p className='text-t-secondary m-0 line-clamp-3'>{mem.content}</p>
                  </div>
                  <button className='text-t-tertiary hover:text-red-500 cursor-pointer bg-transparent b-none opacity-0 group-hover:opacity-100 transition-opacity text-14px shrink-0 mt-2px' onClick={() => handleDeleteMemory(mem.id)} title='Delete this memory'>
                    {'\u00D7'}
                  </button>
                </div>
                {mem.tags.length > 0 && (
                  <div className='flex gap-4px mt-6px flex-wrap'>
                    {mem.tags.map((tag) => (
                      <span key={tag} className='text-10px text-t-tertiary bg-fill-2 px-6px py-1px rd-3px'>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Sub-components & helpers
// ============================================================

const StatCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className='flex flex-col items-center py-12px bg-fill-1 rd-8px'>
    <span className='text-20px font-700 text-t-primary'>{value}</span>
    <span className='text-11px text-t-tertiary mt-2px'>{label}</span>
  </div>
);

const TYPE_COLORS: Record<string, string> = {
  session_summary: 'rgba(59, 130, 246, 0.15)',
  decision: 'rgba(245, 158, 11, 0.15)',
  lesson: 'rgba(239, 68, 68, 0.15)',
  preference: 'rgba(16, 185, 129, 0.15)',
  fact: 'rgba(139, 92, 246, 0.15)',
  correction: 'rgba(236, 72, 153, 0.15)',
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default MemoryModalContent;
