/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Context window size configuration for known models
 */
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // Gemini 3 series (preview)
  'gemini-3-pro-preview': 1_048_576,
  'gemini-3-flash-preview': 1_048_576,
  'gemini-3-pro-image-preview': 65_536,

  // Gemini 2.5 series (stable/production)
  'gemini-2.5-pro': 1_048_576,
  'gemini-2.5-flash': 1_048_576,
  'gemini-2.5-flash-lite': 1_048_576,
  'gemini-2.5-flash-image': 32_768,

  // Gemini 2.0 series (deprecated, retiring March 2026)
  'gemini-2.0-flash': 1_048_576,
  'gemini-2.0-flash-lite': 1_048_576,

  // OpenAI GPT-5 series (current)
  'gpt-5.2': 400_000,
  'gpt-5.2-pro': 400_000,
  'gpt-5.1': 400_000,
  'gpt-5': 400_000,
  'gpt-5-mini': 128_000,
  'gpt-5-nano': 128_000,

  // OpenAI GPT-4 series (legacy, retiring Feb 2026)
  'gpt-4.1': 1_047_576,
  'gpt-4.1-mini': 1_047_576,
  'gpt-4.1-nano': 1_047_576,
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,

  // OpenAI reasoning models
  o3: 200_000,
  'o3-pro': 200_000,
  'o3-mini': 200_000,
  'o4-mini': 200_000,
  o1: 200_000,

  // Claude 4.5 series
  'claude-opus-4.5': 200_000,
  'claude-sonnet-4.5': 1_000_000,
  'claude-haiku-4.5': 200_000,

  // Claude 4.x series
  'claude-opus-4.1': 200_000,
  'claude-opus-4': 200_000,
  'claude-sonnet-4': 1_000_000,

  // Claude 3.x series (legacy, deprecated)
  'claude-3.7-sonnet': 200_000,
  'claude-3.5-haiku': 200_000,
};

/**
 * Default context limit (used when model cannot be determined)
 */
export const DEFAULT_CONTEXT_LIMIT = 1_048_576;

/**
 * Get context limit by model name
 * Supports fuzzy matching, e.g. "gemini-2.5-pro-latest" will match "gemini-2.5-pro"
 */
export function getModelContextLimit(modelName: string | undefined | null): number {
  if (!modelName) return DEFAULT_CONTEXT_LIMIT;

  const lowerModelName = modelName.toLowerCase();

  // Exact match
  if (MODEL_CONTEXT_LIMITS[lowerModelName]) {
    return MODEL_CONTEXT_LIMITS[lowerModelName];
  }

  // Fuzzy match: find the longest matching model name
  let bestMatch = '';
  let bestLimit = DEFAULT_CONTEXT_LIMIT;

  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (lowerModelName.includes(key) && key.length > bestMatch.length) {
      bestMatch = key;
      bestLimit = limit;
    }
  }

  return bestLimit;
}
