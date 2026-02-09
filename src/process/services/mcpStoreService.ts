/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * mcpStoreService — Pre-bundled MCP server catalog.
 *
 * Curated registry of 24+ popular MCP servers with install templates.
 * Each entry provides the transport config needed to add to Foundry.
 */

export interface McpCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  transport: {
    type: 'stdio' | 'sse' | 'http';
    command?: string;
    args?: string[];
    url?: string;
  };
  tags: string[];
  repo?: string;
}

export const MCP_CATALOG: McpCatalogEntry[] = [
  // File System & Dev Tools
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read, write, and manage local files and directories',
    category: 'Development',
    author: 'Anthropic',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'] },
    tags: ['files', 'fs', 'read', 'write'],
    repo: 'modelcontextprotocol/servers',
  },
  {
    id: 'git',
    name: 'Git',
    description: 'Git repository operations — log, diff, blame, branch management',
    category: 'Development',
    author: 'Anthropic',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-git'] },
    tags: ['git', 'vcs', 'version-control'],
    repo: 'modelcontextprotocol/servers',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'GitHub API — issues, PRs, repos, actions, code search',
    category: 'Development',
    author: 'Anthropic',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
    tags: ['github', 'issues', 'pull-requests'],
    repo: 'modelcontextprotocol/servers',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'GitLab API — projects, merge requests, pipelines',
    category: 'Development',
    author: 'Community',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-gitlab'] },
    tags: ['gitlab', 'ci-cd', 'merge-requests'],
    repo: 'modelcontextprotocol/servers',
  },
  // Database
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'Query and manage SQLite databases',
    category: 'Database',
    author: 'Anthropic',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sqlite'] },
    tags: ['sqlite', 'database', 'sql'],
    repo: 'modelcontextprotocol/servers',
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Connect to and query PostgreSQL databases',
    category: 'Database',
    author: 'Anthropic',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres'] },
    tags: ['postgres', 'database', 'sql'],
    repo: 'modelcontextprotocol/servers',
  },
  // Web & Search
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Web search via Brave Search API',
    category: 'Web',
    author: 'Anthropic',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'] },
    tags: ['search', 'web', 'brave'],
    repo: 'modelcontextprotocol/servers',
  },
  {
    id: 'fetch',
    name: 'Fetch',
    description: 'Fetch and parse web pages, convert HTML to markdown',
    category: 'Web',
    author: 'Anthropic',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'] },
    tags: ['fetch', 'web', 'scrape', 'html'],
    repo: 'modelcontextprotocol/servers',
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    description: 'Browser automation — navigate, click, screenshot, fill forms',
    category: 'Web',
    author: 'Anthropic',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-puppeteer'] },
    tags: ['browser', 'automation', 'puppeteer'],
    repo: 'modelcontextprotocol/servers',
  },
  // Cloud & Infrastructure
  {
    id: 'aws-kb',
    name: 'AWS Knowledge Base',
    description: 'Query AWS documentation and knowledge bases',
    category: 'Cloud',
    author: 'Community',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-aws-kb-retrieval'] },
    tags: ['aws', 'cloud', 'knowledge-base'],
    repo: 'modelcontextprotocol/servers',
  },
  {
    id: 'docker',
    name: 'Docker',
    description: 'Manage Docker containers, images, and compose stacks',
    category: 'Cloud',
    author: 'Community',
    transport: { type: 'stdio', command: 'npx', args: ['-y', 'mcp-server-docker'] },
    tags: ['docker', 'containers', 'devops'],
  },
  // Productivity
  {
    id: 'slack',
    name: 'Slack',
    description: 'Read and send Slack messages, manage channels',
    category: 'Productivity',
    author: 'Anthropic',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'] },
    tags: ['slack', 'messaging', 'communication'],
    repo: 'modelcontextprotocol/servers',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Search and read Google Drive files and documents',
    category: 'Productivity',
    author: 'Anthropic',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-gdrive'] },
    tags: ['google', 'drive', 'files', 'docs'],
    repo: 'modelcontextprotocol/servers',
  },
  {
    id: 'google-maps',
    name: 'Google Maps',
    description: 'Geocoding, directions, and place search',
    category: 'Productivity',
    author: 'Anthropic',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-google-maps'] },
    tags: ['maps', 'geocoding', 'directions'],
    repo: 'modelcontextprotocol/servers',
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Persistent key-value memory with knowledge graph',
    category: 'AI',
    author: 'Anthropic',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
    tags: ['memory', 'knowledge', 'graph'],
    repo: 'modelcontextprotocol/servers',
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    description: 'Step-by-step reasoning and problem decomposition',
    category: 'AI',
    author: 'Anthropic',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] },
    tags: ['thinking', 'reasoning', 'chain-of-thought'],
    repo: 'modelcontextprotocol/servers',
  },
  {
    id: 'everything',
    name: 'Everything',
    description: 'Reference / test server with sample tools, resources, prompts',
    category: 'Development',
    author: 'Anthropic',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-everything'] },
    tags: ['test', 'reference', 'demo'],
    repo: 'modelcontextprotocol/servers',
  },
  // Data & Analytics
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Query Sentry issues, events, and error traces',
    category: 'Development',
    author: 'Sentry',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@sentry/mcp-server'] },
    tags: ['sentry', 'errors', 'monitoring'],
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Manage Linear issues, projects, and cycles',
    category: 'Productivity',
    author: 'Community',
    transport: { type: 'stdio', command: 'npx', args: ['-y', 'mcp-server-linear'] },
    tags: ['linear', 'issues', 'project-management'],
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Read and search Notion pages, databases, and blocks',
    category: 'Productivity',
    author: 'Community',
    transport: { type: 'stdio', command: 'npx', args: ['-y', 'mcp-server-notion'] },
    tags: ['notion', 'docs', 'wiki'],
  },
  {
    id: 'raygun',
    name: 'Raygun',
    description: 'Application performance and crash reporting',
    category: 'Development',
    author: 'Raygun',
    transport: { type: 'stdio', command: 'npx', args: ['-y', 'mcp-server-raygun'] },
    tags: ['apm', 'crash', 'monitoring'],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    description: 'Manage Cloudflare Workers, KV, D1, and R2',
    category: 'Cloud',
    author: 'Cloudflare',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@cloudflare/mcp-server-cloudflare'] },
    tags: ['cloudflare', 'workers', 'edge'],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Manage Stripe payments, customers, and subscriptions',
    category: 'Productivity',
    author: 'Community',
    transport: { type: 'stdio', command: 'npx', args: ['-y', 'mcp-server-stripe'] },
    tags: ['stripe', 'payments', 'billing'],
  },
  {
    id: 'playwright',
    name: 'Playwright',
    description: 'Browser testing and automation via Playwright',
    category: 'Development',
    author: 'Microsoft',
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@playwright/mcp'] },
    tags: ['playwright', 'testing', 'browser'],
  },
];

const CATEGORIES = Array.from(new Set(MCP_CATALOG.map((e) => e.category)));

export function getMcpCategories(): string[] {
  return CATEGORIES;
}

export function searchMcpCatalog(query: string, category?: string): McpCatalogEntry[] {
  return MCP_CATALOG.filter((entry) => {
    if (category && entry.category !== category) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return entry.name.toLowerCase().includes(q) || entry.description.toLowerCase().includes(q) || entry.tags.some((t) => t.includes(q));
  });
}
