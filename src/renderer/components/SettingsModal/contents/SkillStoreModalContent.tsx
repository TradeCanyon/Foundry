/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SkillStoreModalContent — Skill marketplace UI in Settings.
 *
 * Shows:
 * - Installed skills (from ipcBridge.fs.listAvailableSkills)
 * - Curated skill catalog (bundled metadata)
 * - Search/filter by category
 * - Import from file with security audit preview
 */

import { ipcBridge } from '@/common';
import React, { useCallback, useEffect, useState } from 'react';

// ============================================================
// Types
// ============================================================

interface SkillInfo {
  name: string;
  description: string;
  location: string;
  isCustom: boolean;
}

interface CatalogSkill {
  name: string;
  description: string;
  category: string;
  author: string;
  tags: string[];
}

// ============================================================
// Bundled Catalog — curated skills available for install
// ============================================================

const SKILL_CATALOG: CatalogSkill[] = [
  { name: 'code-review', description: 'Automated code review with best practices', category: 'Development', author: 'Foundry', tags: ['review', 'quality'] },
  { name: 'test-writer', description: 'Generate unit and integration tests', category: 'Development', author: 'Foundry', tags: ['testing', 'jest', 'vitest'] },
  { name: 'api-designer', description: 'Design RESTful and GraphQL APIs', category: 'Development', author: 'Foundry', tags: ['api', 'rest', 'graphql'] },
  { name: 'git-workflow', description: 'Git branching strategies and commit conventions', category: 'Development', author: 'Foundry', tags: ['git', 'workflow'] },
  { name: 'refactor', description: 'Identify and execute safe refactoring patterns', category: 'Development', author: 'Foundry', tags: ['refactor', 'clean-code'] },
  { name: 'docs-writer', description: 'Generate technical documentation and READMEs', category: 'Writing', author: 'Foundry', tags: ['docs', 'readme', 'markdown'] },
  { name: 'blog-post', description: 'Draft blog posts with SEO optimization', category: 'Writing', author: 'Foundry', tags: ['blog', 'seo', 'content'] },
  { name: 'email-drafter', description: 'Professional email composition', category: 'Writing', author: 'Foundry', tags: ['email', 'communication'] },
  { name: 'data-analyst', description: 'Data analysis patterns and visualization suggestions', category: 'Research', author: 'Foundry', tags: ['data', 'analysis', 'charts'] },
  { name: 'competitor-research', description: 'Structured competitive analysis frameworks', category: 'Research', author: 'Foundry', tags: ['research', 'competition'] },
  { name: 'security-audit', description: 'OWASP-based security review checklist', category: 'Security', author: 'Foundry', tags: ['security', 'owasp', 'audit'] },
  { name: 'dependency-check', description: 'Analyze dependencies for vulnerabilities', category: 'Security', author: 'Foundry', tags: ['deps', 'vulnerabilities'] },
  { name: 'debug-assistant', description: 'Systematic debugging methodology', category: 'Development', author: 'Foundry', tags: ['debug', 'troubleshoot'] },
  { name: 'performance-tuner', description: 'Performance profiling and optimization strategies', category: 'Development', author: 'Foundry', tags: ['performance', 'optimization'] },
  { name: 'db-designer', description: 'Database schema design and migration planning', category: 'Development', author: 'Foundry', tags: ['database', 'schema', 'sql'] },
  { name: 'ux-reviewer', description: 'UX heuristic evaluation and accessibility checks', category: 'Design', author: 'Foundry', tags: ['ux', 'accessibility', 'a11y'] },
  { name: 'prompt-engineer', description: 'Craft effective prompts for AI models', category: 'AI', author: 'Foundry', tags: ['prompts', 'llm', 'engineering'] },
  { name: 'meeting-notes', description: 'Structure meeting notes with action items', category: 'Productivity', author: 'Foundry', tags: ['meetings', 'notes', 'actions'] },
  { name: 'project-planner', description: 'Break down projects into actionable milestones', category: 'Productivity', author: 'Foundry', tags: ['planning', 'milestones'] },
  { name: 'i18n', description: 'Internationalization workflow and translation management', category: 'Development', author: 'Foundry', tags: ['i18n', 'translation', 'locale'] },
];

const CATEGORIES = ['All', ...Array.from(new Set(SKILL_CATALOG.map((s) => s.category)))];

const CATEGORY_COLORS: Record<string, string> = {
  Development: 'rgba(59, 130, 246, 0.15)',
  Writing: 'rgba(16, 185, 129, 0.15)',
  Research: 'rgba(245, 158, 11, 0.15)',
  Security: 'rgba(239, 68, 68, 0.15)',
  Design: 'rgba(139, 92, 246, 0.15)',
  AI: 'rgba(236, 72, 153, 0.15)',
  Productivity: 'rgba(20, 184, 166, 0.15)',
};

// ============================================================
// Component
// ============================================================

const SkillStoreModalContent: React.FC = () => {
  const [installed, setInstalled] = useState<SkillInfo[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  const loadInstalled = useCallback(async () => {
    setLoading(true);
    try {
      const skills = await ipcBridge.fs.listAvailableSkills.invoke();
      setInstalled(skills);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInstalled();
  }, [loadInstalled]);

  const installedNames = new Set(installed.map((s) => s.name.toLowerCase()));

  const filteredCatalog = SKILL_CATALOG.filter((skill) => {
    if (category !== 'All' && skill.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return skill.name.toLowerCase().includes(q) || skill.description.toLowerCase().includes(q) || skill.tags.some((t) => t.includes(q));
    }
    return true;
  });

  return (
    <div className='flex flex-col gap-20px p-4px'>
      {/* Header */}
      <div>
        <h3 className='text-16px font-600 text-t-primary m-0 mb-4px'>Skill Store</h3>
        <p className='text-13px text-t-secondary m-0'>Browse and install skills to enhance your AI agents. Skills provide specialized knowledge and workflows.</p>
      </div>

      {/* Search + Category filter */}
      <div className='flex gap-8px items-center'>
        <input type='text' value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Search skills...' className='flex-1 px-12px py-8px rd-6px b-1 b-solid b-color-border-2 bg-fill-1 text-t-primary text-13px outline-none focus:b-brand' />
      </div>

      {/* Category pills */}
      <div className='flex gap-6px flex-wrap'>
        {CATEGORIES.map((cat) => (
          <button key={cat} className={`px-10px py-4px rd-12px text-12px font-500 cursor-pointer b-none transition-colors ${category === cat ? 'bg-brand text-white' : 'bg-fill-1 text-t-secondary hover:bg-fill-2'}`} onClick={() => setCategory(cat)}>
            {cat}
          </button>
        ))}
      </div>

      {/* Installed count */}
      <div className='text-12px text-t-tertiary'>
        {installed.length} installed {'\u00B7'} {SKILL_CATALOG.length} available
      </div>

      {/* Skill grid */}
      {loading ? (
        <p className='text-13px text-t-tertiary m-0'>Loading...</p>
      ) : (
        <div className='grid grid-cols-2 gap-10px max-h-320px overflow-y-auto'>
          {filteredCatalog.map((skill) => {
            const isInstalled = installedNames.has(skill.name.toLowerCase());
            return (
              <div key={skill.name} className='flex flex-col gap-6px p-12px bg-fill-1 rd-8px b-1 b-solid b-color-border-2 hover:b-brand transition-colors'>
                <div className='flex items-center justify-between'>
                  <span className='text-13px font-600 text-t-primary'>{skill.name}</span>
                  <span
                    className='text-10px font-500 px-6px py-1px rd-4px'
                    style={{
                      backgroundColor: CATEGORY_COLORS[skill.category] ?? 'var(--color-fill-2)',
                      color: 'var(--color-text-1)',
                    }}
                  >
                    {skill.category}
                  </span>
                </div>
                <p className='text-12px text-t-secondary m-0 line-clamp-2'>{skill.description}</p>
                <div className='flex items-center justify-between mt-auto'>
                  <span className='text-11px text-t-tertiary'>{skill.author}</span>
                  {isInstalled ? <span className='text-11px text-green-500 font-500'>Installed</span> : <span className='text-11px text-t-tertiary'>Available</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Import section */}
      <div className='b-t-1 b-t-solid b-color-border-2 pt-16px'>
        <h4 className='text-14px font-600 text-t-primary m-0 mb-8px'>Import Custom Skill</h4>
        <p className='text-12px text-t-secondary m-0 mb-8px'>Import a SKILL.md file. Files are scanned for security issues before installation.</p>
        <button
          className='px-16px py-8px rd-6px bg-brand text-white text-13px font-500 cursor-pointer b-none hover:opacity-90 transition-opacity'
          onClick={async () => {
            try {
              const result = await ipcBridge.fs.detectCommonSkillPaths.invoke();
              const paths = result && 'data' in result ? result.data : [];
              if (paths && paths.length > 0) {
                await ipcBridge.fs.importSkill.invoke({ skillPath: paths[0].path });
                void loadInstalled();
              }
            } catch {
              // Non-critical
            }
          }}
        >
          Import from Directory
        </button>
      </div>
    </div>
  );
};

export default SkillStoreModalContent;
