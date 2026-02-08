/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { ProcessConfig } from '../initStorage';

// Timeout for title generation API calls (10 seconds)
const TITLE_GENERATION_TIMEOUT_MS = 10000;

/**
 * Helper to add timeout to a promise
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/**
 * Generate a smart, concise title for a conversation based on the user's first message.
 * Uses AI to create a meaningful 3-7 word summary instead of just truncating the message.
 */
export async function generateSmartTitle(message: string): Promise<string> {
  // Don't generate titles for very short messages - just use them directly
  if (message.length <= 30 && !message.includes('\n')) {
    return message.trim();
  }

  const prompt = `Generate a very short, concise title (3-7 words max) that summarizes this user request.
The title should be descriptive and capture the main topic/action.
Do NOT include quotes, prefixes like "Title:", or any explanation.
Just output the title text directly.

User request: "${message.slice(0, 500)}"

Title:`;

  // Try to use available AI providers in order of preference
  // Use timeout to prevent long waits
  try {
    // 1. Try Gemini first (most commonly available)
    const geminiTitle = await withTimeout(tryGeminiTitle(prompt), TITLE_GENERATION_TIMEOUT_MS, null);
    if (geminiTitle) return geminiTitle;

    // 2. Try Anthropic/Claude
    const anthropicTitle = await withTimeout(tryAnthropicTitle(prompt), TITLE_GENERATION_TIMEOUT_MS, null);
    if (anthropicTitle) return anthropicTitle;

    // 3. Fallback to smart truncation
    return smartTruncate(message);
  } catch (error) {
    console.warn('[TitleGeneration] AI title generation failed, using fallback:', error);
    return smartTruncate(message);
  }
}

/**
 * Try to generate title using Gemini API
 */
async function tryGeminiTitle(prompt: string): Promise<string | null> {
  try {
    // Check for API key in environment or config
    let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      // Try to get from config
      const modelConfig = await ProcessConfig.get('model.config');
      const geminiProvider = modelConfig?.find((p: any) => p.platform?.toLowerCase().includes('gemini') && p.apiKey);
      apiKey = geminiProvider?.apiKey;
    }

    if (!apiKey) {
      return null;
    }

    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash', // Use fast model for quick title generation
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 50,
        temperature: 0.3, // Low temperature for consistent results
      },
    });

    const title = response.text?.trim();
    if (title && title.length > 0 && title.length <= 100) {
      return cleanTitle(title);
    }
    return null;
  } catch (error) {
    console.debug('[TitleGeneration] Gemini failed:', error);
    return null;
  }
}

/**
 * Try to generate title using Anthropic/Claude API
 */
async function tryAnthropicTitle(prompt: string): Promise<string | null> {
  try {
    // Check for API key in environment or config
    let apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      // Try to get from config
      const modelConfig = await ProcessConfig.get('model.config');
      const anthropicProvider = modelConfig?.find((p: any) => p.platform?.toLowerCase().includes('anthropic') && p.apiKey);
      apiKey = anthropicProvider?.apiKey;
    }

    if (!apiKey) {
      return null;
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307', // Use fast model for quick title generation
      max_tokens: 50,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const title = content.text.trim();
      if (title && title.length > 0 && title.length <= 100) {
        return cleanTitle(title);
      }
    }
    return null;
  } catch (error) {
    console.debug('[TitleGeneration] Anthropic failed:', error);
    return null;
  }
}

/**
 * Clean up the generated title - remove quotes, prefixes, etc.
 */
function cleanTitle(title: string): string {
  let cleaned = title
    // Remove surrounding quotes
    .replace(/^["']|["']$/g, '')
    // Remove common prefixes
    .replace(/^(Title:|Summary:|Topic:)\s*/i, '')
    // Remove leading/trailing whitespace
    .trim();

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Smart truncation fallback - extracts key words instead of just cutting off
 */
function smartTruncate(message: string): string {
  // Take first line only
  const firstLine = message.split('\n')[0].trim();

  // If first line is short enough, use it
  if (firstLine.length <= 50) {
    return firstLine;
  }

  // Try to truncate at a word boundary
  const truncated = firstLine.slice(0, 47);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 20) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}
