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
import React, { useEffect, useState } from 'react';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to load constitution from backend
    import('@/common')
      .then(({ ipcBridge }) => {
        // Try loading from .foundry/constitution.md via IPC
        // For now, fall back to default since we may not have a dedicated IPC endpoint yet
        return ipcBridge.fs?.readFile
          ?.invoke({ path: '.foundry/constitution.md' })
          .then((content: string) => {
            if (content) setConstitution(content);
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

  return (
    <div style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Constitution</h2>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: 'rgba(255, 107, 53, 0.15)',
            color: '#ff6b35',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Human-Only
        </span>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '20px' }}>
        These rules govern all AI agent behavior in Foundry. They are injected into every conversation and cannot be overridden by agents. To customize, edit <code style={{ fontSize: '12px', backgroundColor: 'var(--bg-2)', padding: '1px 4px', borderRadius: '3px' }}>.foundry/constitution.md</code> in your project.
      </p>

      {/* Constitution content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          border: '1px solid var(--bg-3)',
          borderRadius: '8px',
          padding: '16px',
          backgroundColor: 'var(--bg-1)',
        }}
      >
        {loading ? <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px' }}>Loading...</div> : <MarkdownView>{constitution}</MarkdownView>}
      </div>
    </div>
  );
};

export default ConstitutionModalContent;
