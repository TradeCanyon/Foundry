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
 * - Expandable detail view per skill
 * - Delete user-imported skills
 * - Import from directory or URL
 */

import { ipcBridge } from '@/common';
import { Tooltip } from '@arco-design/web-react';
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
  details?: string;
}

// ============================================================
// Bundled Catalog — curated skills available for install
// ============================================================

const SKILL_CATALOG: CatalogSkill[] = [
  { name: 'code-review', description: 'Automated code review with best practices', category: 'Development', author: 'Foundry', tags: ['review', 'quality'], details: 'Performs comprehensive code reviews covering readability, maintainability, security, and performance. Checks for common anti-patterns and suggests improvements.' },
  { name: 'test-writer', description: 'Generate unit and integration tests', category: 'Development', author: 'Foundry', tags: ['testing', 'jest', 'vitest'], details: 'Creates test suites following AAA (Arrange-Act-Assert) pattern. Supports Jest, Vitest, and Playwright. Generates edge case coverage.' },
  { name: 'api-designer', description: 'Design RESTful and GraphQL APIs', category: 'Development', author: 'Foundry', tags: ['api', 'rest', 'graphql'], details: 'Helps design API endpoints with proper HTTP methods, status codes, pagination, versioning, and OpenAPI/Swagger documentation.' },
  { name: 'git-workflow', description: 'Git branching strategies and commit conventions', category: 'Development', author: 'Foundry', tags: ['git', 'workflow'], details: 'Enforces conventional commits, suggests branching strategies (trunk-based, GitFlow), and automates PR descriptions.' },
  { name: 'refactor', description: 'Identify and execute safe refactoring patterns', category: 'Development', author: 'Foundry', tags: ['refactor', 'clean-code'], details: 'Identifies code smells and applies Martin Fowler refactoring patterns. Ensures behavioral equivalence through careful analysis.' },
  { name: 'docs-writer', description: 'Generate technical documentation and READMEs', category: 'Writing', author: 'Foundry', tags: ['docs', 'readme', 'markdown'], details: 'Creates structured documentation including API references, architecture guides, and README files with proper markdown formatting.' },
  { name: 'blog-post', description: 'Draft blog posts with SEO optimization', category: 'Writing', author: 'Foundry', tags: ['blog', 'seo', 'content'], details: 'Drafts engaging blog posts with SEO-optimized headings, meta descriptions, keyword placement, and readability scoring.' },
  { name: 'email-drafter', description: 'Professional email composition', category: 'Writing', author: 'Foundry', tags: ['email', 'communication'], details: 'Composes professional emails with appropriate tone, clear structure, and actionable next steps. Supports follow-ups and templates.' },
  { name: 'data-analyst', description: 'Data analysis patterns and visualization suggestions', category: 'Research', author: 'Foundry', tags: ['data', 'analysis', 'charts'], details: 'Guides data analysis workflows including cleaning, transformation, statistical analysis, and chart/visualization recommendations.' },
  { name: 'competitor-research', description: 'Structured competitive analysis frameworks', category: 'Research', author: 'Foundry', tags: ['research', 'competition'], details: 'Provides structured frameworks for competitive analysis including SWOT, feature matrices, and market positioning.' },
  { name: 'security-audit', description: 'OWASP-based security review checklist', category: 'Security', author: 'Foundry', tags: ['security', 'owasp', 'audit'], details: 'Systematic security review based on OWASP Top 10. Checks for injection, XSS, CSRF, authentication flaws, and sensitive data exposure.' },
  { name: 'dependency-check', description: 'Analyze dependencies for vulnerabilities', category: 'Security', author: 'Foundry', tags: ['deps', 'vulnerabilities'], details: 'Scans project dependencies for known vulnerabilities, outdated versions, and license compliance issues.' },
  { name: 'debug-assistant', description: 'Systematic debugging methodology', category: 'Development', author: 'Foundry', tags: ['debug', 'troubleshoot'], details: 'Applies systematic debugging: reproduce, isolate, identify root cause, fix, verify. Suggests logging strategies and breakpoint placement.' },
  { name: 'performance-tuner', description: 'Performance profiling and optimization strategies', category: 'Development', author: 'Foundry', tags: ['performance', 'optimization'], details: 'Identifies performance bottlenecks and suggests optimizations for rendering, network, memory, and computation.' },
  { name: 'db-designer', description: 'Database schema design and migration planning', category: 'Development', author: 'Foundry', tags: ['database', 'schema', 'sql'], details: 'Designs normalized schemas, creates migration scripts, suggests indexing strategies, and handles schema evolution.' },
  { name: 'ux-reviewer', description: 'UX heuristic evaluation and accessibility checks', category: 'Design', author: 'Foundry', tags: ['ux', 'accessibility', 'a11y'], details: 'Evaluates interfaces using Nielsen heuristics. Checks WCAG 2.1 AA compliance, color contrast, keyboard navigation, and ARIA usage.' },
  { name: 'prompt-engineer', description: 'Craft effective prompts for AI models', category: 'AI', author: 'Foundry', tags: ['prompts', 'llm', 'engineering'], details: 'Helps design effective prompts with techniques like chain-of-thought, few-shot examples, and structured output formatting.' },
  { name: 'meeting-notes', description: 'Structure meeting notes with action items', category: 'Productivity', author: 'Foundry', tags: ['meetings', 'notes', 'actions'], details: 'Structures meeting transcripts into organized notes with attendees, decisions, action items, and deadlines.' },
  { name: 'project-planner', description: 'Break down projects into actionable milestones', category: 'Productivity', author: 'Foundry', tags: ['planning', 'milestones'], details: 'Creates project breakdowns with milestones, dependencies, effort estimates, and risk identification.' },
  { name: 'i18n', description: 'Internationalization workflow and translation management', category: 'Development', author: 'Foundry', tags: ['i18n', 'translation', 'locale'], details: 'Manages i18n key naming conventions, detects hardcoded strings, syncs locale files, and guides translation workflows.' },
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
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');

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

  const handleDeleteSkill = useCallback(
    async (skill: SkillInfo) => {
      if (!skill.isCustom) return;
      if (!confirm(`Delete custom skill "${skill.name}"? This cannot be undone.`)) return;
      try {
        await ipcBridge.fs.removeEntry.invoke({ path: skill.location });
      } catch {
        // Non-critical
      }
      void loadInstalled();
    },
    [loadInstalled]
  );

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

      {/* Installed custom skills */}
      {installed.filter((s) => s.isCustom).length > 0 && (
        <div>
          <h4 className='text-13px font-600 text-t-primary m-0 mb-8px'>Custom Skills</h4>
          <div className='flex flex-col gap-6px'>
            {installed
              .filter((s) => s.isCustom)
              .map((skill) => (
                <div key={skill.location} className='flex items-center gap-8px px-12px py-8px bg-fill-1 rd-6px text-13px group'>
                  <span className='text-t-primary font-500 flex-1'>{skill.name}</span>
                  <span className='text-11px text-t-tertiary truncate max-w-200px' title={skill.location}>
                    {skill.location.split(/[/\\]/).slice(-2).join('/')}
                  </span>
                  <Tooltip content='Delete this custom skill'>
                    <button className='text-t-tertiary hover:text-red-500 cursor-pointer bg-transparent b-none opacity-0 group-hover:opacity-100 transition-opacity text-14px' onClick={() => void handleDeleteSkill(skill)}>
                      {'\u00D7'}
                    </button>
                  </Tooltip>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Skill grid */}
      {loading ? (
        <p className='text-13px text-t-tertiary m-0'>Loading...</p>
      ) : (
        <div className='grid grid-cols-2 gap-10px max-h-320px overflow-y-auto'>
          {filteredCatalog.map((skill) => {
            const isInstalled = installedNames.has(skill.name.toLowerCase());
            const isExpanded = expandedSkill === skill.name;
            return (
              <div key={skill.name} className='flex flex-col gap-6px p-12px bg-fill-1 rd-8px b-1 b-solid b-color-border-2 hover:b-brand transition-colors cursor-pointer' onClick={() => setExpandedSkill(isExpanded ? null : skill.name)}>
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

                {/* Expanded detail */}
                {isExpanded && skill.details && (
                  <div className='mt-4px pt-6px b-t-1 b-t-solid b-color-border-2'>
                    <p className='text-12px text-t-secondary m-0 mb-6px'>{skill.details}</p>
                    <div className='flex gap-4px flex-wrap'>
                      {skill.tags.map((tag) => (
                        <span key={tag} className='text-10px text-t-tertiary bg-fill-2 px-6px py-1px rd-3px'>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

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
        <div className='flex flex-col gap-8px'>
          <button
            className='px-16px py-8px rd-6px bg-brand text-white text-13px font-500 cursor-pointer b-none hover:opacity-90 transition-opacity w-fit'
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

          {/* URL import */}
          <div className='flex gap-8px items-center'>
            <input type='text' value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder='https://github.com/.../SKILL.md' className='flex-1 px-12px py-8px rd-6px b-1 b-solid b-color-border-2 bg-fill-1 text-t-primary text-13px outline-none focus:b-brand' />
            <button
              className='px-12px py-8px rd-6px text-13px font-500 cursor-pointer b-1 b-solid b-color-border-2 bg-fill-1 text-t-primary hover:bg-fill-2 transition-colors disabled:opacity-50'
              disabled={!importUrl.trim()}
              onClick={async () => {
                if (!importUrl.trim()) return;
                try {
                  await ipcBridge.fs.importSkill.invoke({ skillPath: importUrl.trim() });
                  setImportUrl('');
                  void loadInstalled();
                } catch {
                  // Non-critical
                }
              }}
            >
              Import URL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillStoreModalContent;
