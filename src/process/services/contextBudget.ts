/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ContextBudget — Per-agent token budget allocator.
 *
 * Manages the context window budget across:
 *   Constitution (fixed) → Skills (capped) → Memory (dynamic) → Conversation (remainder)
 *
 * Estimates tokens at ~4 characters per token (conservative for English text).
 */

const CHARS_PER_TOKEN = 4;

export interface ContextBudgetConfig {
  /** Total context window size in tokens */
  totalTokens: number;
  /** Fixed token allocation for constitution */
  constitutionTokens?: number;
  /** Maximum token allocation for skills */
  skillsMaxTokens?: number;
  /** Maximum percentage of total for memory (0-1) */
  memoryMaxPercent?: number;
}

export interface ContextBudgetAllocation {
  constitution: number;
  skills: number;
  memory: number;
  conversation: number;
}

const DEFAULT_CONFIG: Required<ContextBudgetConfig> = {
  totalTokens: 128_000, // Gemini 2.5 Flash default
  constitutionTokens: 500, // ~2000 chars, fixed
  skillsMaxTokens: 2_000, // ~8000 chars, capped
  memoryMaxPercent: 0.15, // 15% of total
};

/**
 * Estimate token count from a string.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Allocate context budget across sections.
 *
 * Priority order (high to low):
 * 1. Constitution — fixed allocation, always included
 * 2. Skills — capped, included if enabled
 * 3. Memory — dynamic percentage of total, fills available space
 * 4. Conversation — gets the remainder
 */
export function allocateBudget(config?: Partial<ContextBudgetConfig>): ContextBudgetAllocation {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  let remaining = cfg.totalTokens;

  // 1. Constitution (fixed)
  const constitution = Math.min(cfg.constitutionTokens, remaining);
  remaining -= constitution;

  // 2. Skills (capped)
  const skills = Math.min(cfg.skillsMaxTokens, remaining);
  remaining -= skills;

  // 3. Memory (dynamic, up to percentage of total)
  const memoryMax = Math.floor(cfg.totalTokens * cfg.memoryMaxPercent);
  const memory = Math.min(memoryMax, remaining);
  remaining -= memory;

  // 4. Conversation (remainder)
  const conversation = remaining;

  return { constitution, skills, memory, conversation };
}

/**
 * Truncate content to fit within a token budget.
 * Preserves the beginning of the content (most important context).
 */
export function truncateToTokenBudget(content: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars) + '\n[...truncated to fit context budget]';
}
