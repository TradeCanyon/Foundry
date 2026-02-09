/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ConstitutionModalContent — Read-only viewer for the Foundry constitution.
 * Shows the constitution with syntax-highlighted markdown.
 * Human-only badge indicates these rules cannot be overridden by agents.
 */

import MarkdownView from '@/renderer/components/Markdown';
import React, { useEffect, useMemo, useState } from 'react';

const DEFAULT_CONSTITUTION = `# Foundry Constitution

## Core Principles

### I. Safety and Ethics
- Never produce harmful, deceptive, or malicious content
- Respect user privacy — data stays local unless user explicitly shares
- Be transparent about capabilities and limitations
- Refuse requests that could cause harm to users or systems

### II. Quality Standards
- Provide accurate, well-reasoned responses
- Acknowledge uncertainty rather than guessing
- Cite sources and evidence when possible
- Prefer correctness over speed

### III. Communication
- Be concise and direct — respect the user's time
- Use clear, unambiguous language
- Adapt tone to context (technical, casual, formal)
- Ask clarifying questions when requirements are ambiguous

### IV. Security First
- Never expose API keys, credentials, or sensitive data
- Validate inputs at system boundaries
- Follow OWASP security best practices in generated code
- Warn users about security implications of their requests

### V. Tool Usage
- Use the right tool for the job
- Explain tool actions before executing when the impact is significant
- Handle tool errors gracefully with actionable feedback
- Respect rate limits and resource constraints

### VI. Code Quality
- Write clean, maintainable, well-typed code
- Follow existing project conventions and patterns
- Don't over-engineer — solve the actual problem
- Test critical paths and edge cases
`;

const ConstitutionModalContent: React.FC = () => {
  const [constitution, setConstitution] = useState<string>(DEFAULT_CONSTITUTION);
  const [source, setSource] = useState<'default' | 'custom'>('default');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    import('@/common')
      .then(({ ipcBridge }) => {
        return ipcBridge.fs?.readFile
          ?.invoke({ path: '.foundry/constitution.md' })
          .then((content: string) => {
            if (content) {
              setConstitution(content);
              setSource('custom');
            }
          })
          .catch(() => {
            // Use default
          });
      })
      .catch(() => {
        // Use default
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredConstitution = useMemo(() => {
    if (!searchQuery.trim()) return constitution;
    const query = searchQuery.toLowerCase();
    const lines = constitution.split('\n');
    const filtered: string[] = [];
    let currentSection: string[] = [];
    let sectionMatches = false;
    let currentHeader = '';

    for (const line of lines) {
      if (line.startsWith('#')) {
        // Flush previous section if it matched
        if (sectionMatches && currentSection.length > 0) {
          if (currentHeader) filtered.push(currentHeader);
          filtered.push(...currentSection);
        }
        currentHeader = line;
        currentSection = [];
        sectionMatches = line.toLowerCase().includes(query);
      } else {
        currentSection.push(line);
        if (line.toLowerCase().includes(query)) sectionMatches = true;
      }
    }
    // Flush last section
    if (sectionMatches && currentSection.length > 0) {
      if (currentHeader) filtered.push(currentHeader);
      filtered.push(...currentSection);
    }

    return filtered.length > 0 ? filtered.join('\n') : `No principles matching "${searchQuery}"`;
  }, [constitution, searchQuery]);

  return (
    <div className='flex flex-col h-full p-16px'>
      {/* Header */}
      <div className='flex items-center gap-12px mb-16px'>
        <h2 className='m-0 text-18px font-600 text-t-primary'>Constitution</h2>
        <span className='px-8px py-2px rd-4px text-11px font-600 uppercase tracking-0.5px' style={{ backgroundColor: 'rgba(255, 107, 53, 0.15)', color: '#ff6b35' }}>
          Human-Only
        </span>
        <span className='text-11px text-t-tertiary ml-auto'>Source: {source === 'custom' ? 'Custom (.foundry/constitution.md)' : 'Default'}</span>
      </div>

      <p className='m-0 mb-12px text-13px text-t-secondary leading-20px'>
        These rules govern all AI agent behavior in Foundry. They are injected into every conversation and cannot be overridden by agents. To customize, edit <code className='text-12px bg-fill-2 px-4px py-1px rd-3px'>.foundry/constitution.md</code> in your project.
      </p>

      {/* Search */}
      <input type='text' value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder='Filter principles...' className='w-full px-12px py-8px rd-6px b-1 b-solid b-color-border-2 bg-fill-1 text-t-primary text-13px outline-none focus:b-brand mb-12px' />

      {/* Constitution content */}
      <div className='flex-1 overflow-auto b-1 b-solid b-color-border-2 rd-8px p-16px bg-bg-1'>{loading ? <div className='text-t-secondary text-center py-24px'>Loading...</div> : <MarkdownView>{filteredConstitution}</MarkdownView>}</div>
    </div>
  );
};

export default ConstitutionModalContent;
