/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { ProcessConfig } from '../initStorage';

const SUGGESTION_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/**
 * Generate a brief suggested reply based on the last AI message.
 * Returns empty string on any failure (graceful degrade).
 */
export async function generateSuggestedReply(lastAiMessage: string, modelName?: string): Promise<string> {
  if (!lastAiMessage || lastAiMessage.trim().length === 0) {
    return '';
  }

  try {
    const suggestion = await withTimeout(tryGeminiSuggestion(lastAiMessage, modelName), SUGGESTION_TIMEOUT_MS, '');
    return suggestion;
  } catch {
    return '';
  }
}

async function tryGeminiSuggestion(lastAiMessage: string, modelName?: string): Promise<string> {
  let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    const modelConfig = await ProcessConfig.get('model.config');
    const geminiProvider = modelConfig?.find((p: any) => p.platform?.toLowerCase().includes('gemini') && p.apiKey);
    apiKey = geminiProvider?.apiKey;
  }

  if (!apiKey) {
    return '';
  }

  const truncated = lastAiMessage.slice(0, 1000);

  const modelContext = modelName ? `\nThe user is chatting with ${modelName}. Suggest actions appropriate for this model's typical capabilities.` : '';

  const prompt = `Based on this AI assistant response, suggest a very brief (3-8 word) next action the user would likely want. Return ONLY the suggestion text, no quotes or explanation. If the AI asked a question, return empty.${modelContext}

Response: ${truncated}`;

  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      maxOutputTokens: 30,
      temperature: 0.3,
    },
  });

  const suggestion = response.text
    ?.trim()
    .replace(/^["']|["']$/g, '')
    .trim();

  if (suggestion && suggestion.length > 0 && suggestion.length <= 80) {
    return suggestion;
  }
  return '';
}
