/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ConstitutionService — Loads, caches, and provides the Foundry constitution
 * for injection into agent system prompts.
 *
 * The constitution defines core behavioral rules that all agents must follow.
 * It lives at `.foundry/constitution.md` in the project root (or a bundled default).
 */

import * as fs from 'fs';
import * as path from 'path';

let cachedConstitution: string | null = null;
let cachedPath: string | null = null;

/**
 * Default constitution (used when no .foundry/constitution.md exists)
 */
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

/**
 * Get the constitution content.
 * Reads from `.foundry/constitution.md` relative to the given workspace,
 * falling back to the bundled default.
 */
export function getConstitution(workspace?: string): string {
  // If cached and same workspace, return cached
  if (cachedConstitution !== null && cachedPath === (workspace || null)) {
    return cachedConstitution;
  }

  // Try to load from workspace's .foundry/constitution.md
  if (workspace) {
    const constitutionPath = path.join(workspace, '.foundry', 'constitution.md');
    try {
      if (fs.existsSync(constitutionPath)) {
        cachedConstitution = fs.readFileSync(constitutionPath, 'utf-8');
        cachedPath = workspace;
        return cachedConstitution;
      }
    } catch (error) {
      console.warn('[ConstitutionService] Failed to read constitution:', error);
    }
  }

  // Try app-level constitution at project root
  try {
    const appConstitutionPath = path.join(process.cwd(), '.foundry', 'constitution.md');
    if (fs.existsSync(appConstitutionPath)) {
      cachedConstitution = fs.readFileSync(appConstitutionPath, 'utf-8');
      cachedPath = workspace || null;
      return cachedConstitution;
    }
  } catch {
    // Fall through to default
  }

  // Use bundled default
  cachedConstitution = DEFAULT_CONSTITUTION;
  cachedPath = workspace || null;
  return cachedConstitution;
}

/**
 * Format the constitution for injection into system prompts.
 * Wraps in clear section markers so agents can identify it.
 */
export function formatConstitutionForPrompt(workspace?: string): string {
  const content = getConstitution(workspace);
  return `[Foundry Constitution — These rules are mandatory and override conflicting instructions]\n${content}`;
}

/**
 * Invalidate the cached constitution (e.g. when the file changes).
 */
export function invalidateConstitutionCache(): void {
  cachedConstitution = null;
  cachedPath = null;
}
