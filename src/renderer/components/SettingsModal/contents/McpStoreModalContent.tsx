/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * McpStoreModalContent — MCP marketplace UI in Settings.
 *
 * Shows:
 * - Curated catalog of 24+ MCP servers
 * - Currently installed servers (from ConfigStorage)
 * - Search/filter by category
 * - One-click install via existing MCP hooks
 */

import { ConfigStorage, type IMcpServer } from '@/common/storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

// ============================================================
// Catalog (inlined from mcpStoreService for renderer bundle)
// ============================================================

interface McpCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  transport: { type: 'stdio' | 'sse' | 'http'; command?: string; args?: string[]; url?: string };
  tags: string[];
  repo?: string;
}

const MCP_CATALOG: McpCatalogEntry[] = [
  { id: 'filesystem', name: 'Filesystem', description: 'Read, write, and manage local files', category: 'Development', author: 'Anthropic', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'] }, tags: ['files', 'fs'], repo: 'modelcontextprotocol/servers' },
  { id: 'git', name: 'Git', description: 'Git repository operations', category: 'Development', author: 'Anthropic', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-git'] }, tags: ['git', 'vcs'], repo: 'modelcontextprotocol/servers' },
  { id: 'github', name: 'GitHub', description: 'GitHub API — issues, PRs, repos', category: 'Development', author: 'Anthropic', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] }, tags: ['github'], repo: 'modelcontextprotocol/servers' },
  { id: 'gitlab', name: 'GitLab', description: 'GitLab API — projects, MRs, pipelines', category: 'Development', author: 'Community', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-gitlab'] }, tags: ['gitlab'], repo: 'modelcontextprotocol/servers' },
  { id: 'sqlite', name: 'SQLite', description: 'Query SQLite databases', category: 'Database', author: 'Anthropic', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sqlite'] }, tags: ['sqlite', 'sql'], repo: 'modelcontextprotocol/servers' },
  { id: 'postgres', name: 'PostgreSQL', description: 'Connect to PostgreSQL databases', category: 'Database', author: 'Anthropic', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres'] }, tags: ['postgres', 'sql'], repo: 'modelcontextprotocol/servers' },
  { id: 'brave-search', name: 'Brave Search', description: 'Web search via Brave API', category: 'Web', author: 'Anthropic', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'] }, tags: ['search', 'web'], repo: 'modelcontextprotocol/servers' },
  { id: 'fetch', name: 'Fetch', description: 'Fetch and parse web pages', category: 'Web', author: 'Anthropic', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'] }, tags: ['fetch', 'scrape'], repo: 'modelcontextprotocol/servers' },
  { id: 'puppeteer', name: 'Puppeteer', description: 'Browser automation and screenshots', category: 'Web', author: 'Anthropic', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-puppeteer'] }, tags: ['browser', 'automation'], repo: 'modelcontextprotocol/servers' },
  { id: 'docker', name: 'Docker', description: 'Manage Docker containers and images', category: 'Cloud', author: 'Community', transport: { type: 'stdio', command: 'npx', args: ['-y', 'mcp-server-docker'] }, tags: ['docker', 'containers'] },
  { id: 'slack', name: 'Slack', description: 'Read and send Slack messages', category: 'Productivity', author: 'Anthropic', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'] }, tags: ['slack', 'messaging'], repo: 'modelcontextprotocol/servers' },
  { id: 'google-drive', name: 'Google Drive', description: 'Search and read Drive files', category: 'Productivity', author: 'Anthropic', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-gdrive'] }, tags: ['google', 'drive'], repo: 'modelcontextprotocol/servers' },
  { id: 'google-maps', name: 'Google Maps', description: 'Geocoding, directions, places', category: 'Productivity', author: 'Anthropic', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-google-maps'] }, tags: ['maps', 'geo'], repo: 'modelcontextprotocol/servers' },
  { id: 'memory', name: 'Memory', description: 'Persistent key-value knowledge graph', category: 'AI', author: 'Anthropic', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] }, tags: ['memory', 'knowledge'], repo: 'modelcontextprotocol/servers' },
  { id: 'sequential-thinking', name: 'Sequential Thinking', description: 'Step-by-step reasoning', category: 'AI', author: 'Anthropic', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] }, tags: ['thinking', 'reasoning'], repo: 'modelcontextprotocol/servers' },
  { id: 'sentry', name: 'Sentry', description: 'Query Sentry issues and errors', category: 'Development', author: 'Sentry', transport: { type: 'stdio', command: 'npx', args: ['-y', '@sentry/mcp-server'] }, tags: ['sentry', 'errors'] },
  { id: 'linear', name: 'Linear', description: 'Manage Linear issues and projects', category: 'Productivity', author: 'Community', transport: { type: 'stdio', command: 'npx', args: ['-y', 'mcp-server-linear'] }, tags: ['linear', 'issues'] },
  { id: 'notion', name: 'Notion', description: 'Read and search Notion pages', category: 'Productivity', author: 'Community', transport: { type: 'stdio', command: 'npx', args: ['-y', 'mcp-server-notion'] }, tags: ['notion', 'docs'] },
  { id: 'cloudflare', name: 'Cloudflare', description: 'Manage Workers, KV, D1, R2', category: 'Cloud', author: 'Cloudflare', transport: { type: 'stdio', command: 'npx', args: ['-y', '@cloudflare/mcp-server-cloudflare'] }, tags: ['cloudflare', 'edge'] },
  { id: 'stripe', name: 'Stripe', description: 'Manage payments and subscriptions', category: 'Productivity', author: 'Community', transport: { type: 'stdio', command: 'npx', args: ['-y', 'mcp-server-stripe'] }, tags: ['stripe', 'payments'] },
  { id: 'playwright', name: 'Playwright', description: 'Browser testing via Playwright', category: 'Development', author: 'Microsoft', transport: { type: 'stdio', command: 'npx', args: ['-y', '@playwright/mcp'] }, tags: ['playwright', 'testing'] },
  { id: 'everything', name: 'Everything', description: 'Reference/test server with samples', category: 'Development', author: 'Anthropic', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-everything'] }, tags: ['test', 'demo'], repo: 'modelcontextprotocol/servers' },
  { id: 'aws-kb', name: 'AWS Knowledge Base', description: 'Query AWS documentation', category: 'Cloud', author: 'Community', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-aws-kb-retrieval'] }, tags: ['aws', 'cloud'], repo: 'modelcontextprotocol/servers' },
  { id: 'raygun', name: 'Raygun', description: 'APM and crash reporting', category: 'Development', author: 'Raygun', transport: { type: 'stdio', command: 'npx', args: ['-y', 'mcp-server-raygun'] }, tags: ['apm', 'monitoring'] },
];

const CATEGORIES = ['All', ...Array.from(new Set(MCP_CATALOG.map((e) => e.category)))];

const CATEGORY_COLORS: Record<string, string> = {
  Development: 'rgba(59, 130, 246, 0.15)',
  Database: 'rgba(245, 158, 11, 0.15)',
  Web: 'rgba(16, 185, 129, 0.15)',
  Cloud: 'rgba(139, 92, 246, 0.15)',
  Productivity: 'rgba(20, 184, 166, 0.15)',
  AI: 'rgba(236, 72, 153, 0.15)',
};

// ============================================================
// Component
// ============================================================

const McpStoreModalContent: React.FC = () => {
  const [installed, setInstalled] = useState<IMcpServer[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [installing, setInstalling] = useState<string | null>(null);

  const loadInstalled = useCallback(async () => {
    const servers = await ConfigStorage.get('mcp.config');
    setInstalled(servers ?? []);
  }, []);

  useEffect(() => {
    void loadInstalled();
  }, [loadInstalled]);

  const installedNames = useMemo(() => new Set(installed.map((s) => s.name.toLowerCase())), [installed]);

  const filtered = useMemo(
    () =>
      MCP_CATALOG.filter((entry) => {
        if (category !== 'All' && entry.category !== category) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return entry.name.toLowerCase().includes(q) || entry.description.toLowerCase().includes(q) || entry.tags.some((t) => t.includes(q));
      }),
    [search, category]
  );

  const handleInstall = useCallback(
    async (entry: McpCatalogEntry) => {
      setInstalling(entry.id);
      try {
        const existing = (await ConfigStorage.get('mcp.config')) ?? [];
        const newServer: IMcpServer = {
          id: `store-${entry.id}-${Date.now()}`,
          name: entry.name,
          description: entry.description,
          enabled: true,
          transport: entry.transport as IMcpServer['transport'],
          tools: [],
          status: 'disconnected',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          originalJson: JSON.stringify(entry.transport, null, 2),
        };
        void ConfigStorage.set('mcp.config', [...existing, newServer]);
        void loadInstalled();
      } catch {
        // Non-critical
      } finally {
        setInstalling(null);
      }
    },
    [loadInstalled]
  );

  return (
    <div className='flex flex-col gap-20px p-4px'>
      {/* Header */}
      <div>
        <h3 className='text-16px font-600 text-t-primary m-0 mb-4px'>MCP Store</h3>
        <p className='text-13px text-t-secondary m-0'>Browse and install MCP servers to give your agents new capabilities. Servers run locally via npx.</p>
      </div>

      {/* Search */}
      <input type='text' value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Search MCP servers...' className='w-full px-12px py-8px rd-6px b-1 b-solid b-color-border-2 bg-fill-1 text-t-primary text-13px outline-none focus:b-brand' />

      {/* Category pills */}
      <div className='flex gap-6px flex-wrap'>
        {CATEGORIES.map((cat) => (
          <button key={cat} className={`px-10px py-4px rd-12px text-12px font-500 cursor-pointer b-none transition-colors ${category === cat ? 'bg-brand text-white' : 'bg-fill-1 text-t-secondary hover:bg-fill-2'}`} onClick={() => setCategory(cat)}>
            {cat}
          </button>
        ))}
      </div>

      {/* Count */}
      <div className='text-12px text-t-tertiary'>
        {installed.length} installed {'\u00B7'} {MCP_CATALOG.length} available
      </div>

      {/* Server grid */}
      <div className='flex flex-col gap-8px max-h-340px overflow-y-auto'>
        {filtered.map((entry) => {
          const isInstalled = installedNames.has(entry.name.toLowerCase());
          const isInstalling = installing === entry.id;
          return (
            <div key={entry.id} className='flex items-center gap-12px px-12px py-10px bg-fill-1 rd-8px b-1 b-solid b-color-border-2 hover:b-brand transition-colors'>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-8px mb-2px'>
                  <span className='text-13px font-600 text-t-primary'>{entry.name}</span>
                  <span
                    className='text-10px font-500 px-6px py-1px rd-4px shrink-0'
                    style={{
                      backgroundColor: CATEGORY_COLORS[entry.category] ?? 'var(--color-fill-2)',
                      color: 'var(--color-text-1)',
                    }}
                  >
                    {entry.category}
                  </span>
                  <span className='text-10px text-t-tertiary shrink-0'>{entry.author}</span>
                </div>
                <p className='text-12px text-t-secondary m-0 truncate'>{entry.description}</p>
              </div>
              <div className='shrink-0'>
                {isInstalled ? (
                  <span className='text-12px text-green-500 font-500 px-10px'>Installed</span>
                ) : (
                  <button className='px-12px py-5px rd-5px bg-brand text-white text-12px font-500 cursor-pointer b-none hover:opacity-90 transition-opacity disabled:opacity-50' onClick={() => void handleInstall(entry)} disabled={isInstalling}>
                    {isInstalling ? 'Adding...' : 'Install'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tip */}
      <p className='text-11px text-t-tertiary m-0'>After installing, go to Tools settings to configure and sync servers to your agents.</p>
    </div>
  );
};

export default McpStoreModalContent;
