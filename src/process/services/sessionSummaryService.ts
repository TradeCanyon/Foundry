/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SessionSummaryService — Post-conversation memory extraction.
 *
 * After a conversation ends (or reaches a natural pause), generates:
 * 1. Session summary — what happened, key decisions
 * 2. User preferences — observed patterns in communication/working style
 * 3. Lessons — things that went wrong, corrections made
 *
 * Uses Gemini Flash for fast/cheap extraction. Falls back gracefully if unavailable.
 */

import { GoogleGenAI } from '@google/genai';
import { getDatabase } from '@process/database';
import type { TMessage } from '@process/database/types';
import { ProcessConfig } from '../initStorage';
import { storeSessionSummary, storeMemory, learnPreference, sanitizeForMemory } from './memoryService';
import { reportDegraded } from '@/common/utils/gracefulDegradation';

const SUMMARY_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

interface SessionExtractionResult {
  summary: string;
  decisions: string[];
  lessons: string[];
  preferences: Array<{ category: string; key: string; value: string }>;
  tags: string[];
}

/**
 * Extract memories from a completed conversation.
 * Called when conversation status transitions to 'finished' or after inactivity.
 */
export async function extractSessionMemories(conversationId: string): Promise<void> {
  try {
    const db = getDatabase();

    // Get conversation info
    const convResult = db.getConversation(conversationId);
    if (!convResult.success || !convResult.data) return;

    const conversation = convResult.data;
    const workspace = conversation.extra?.workspace ?? null;

    // Get messages (last 50 — enough for a summary without blowing up context)
    const msgResult = db.getConversationMessages(conversationId, 0, 50, 'ASC');
    if (!msgResult.data || msgResult.data.length < 2) return; // Need at least a user+AI exchange

    // Build transcript
    const transcript = buildTranscript(msgResult.data);
    if (transcript.length < 100) return; // Too short to summarize

    // Generate extraction via Gemini Flash
    const extraction = await withTimeout(generateExtraction(transcript, conversation.name), SUMMARY_TIMEOUT_MS, null);

    if (!extraction) {
      // Fallback: store a basic summary from the conversation name
      storeSessionSummary({
        summary: `Session: ${conversation.name}`,
        workspace,
        conversationId,
        tags: ['auto-summary', 'fallback'],
      });
      return;
    }

    // Store summary
    if (extraction.summary) {
      storeSessionSummary({
        summary: extraction.summary,
        workspace,
        conversationId,
        tags: extraction.tags,
      });
    }

    // Store decisions
    for (const decision of extraction.decisions) {
      storeMemory({
        content: decision,
        type: 'decision',
        workspace,
        conversationId,
        source: 'auto',
        tags: ['decision', ...extraction.tags],
        importance: 7,
      });
    }

    // Store lessons
    for (const lesson of extraction.lessons) {
      storeMemory({
        content: lesson,
        type: 'lesson',
        workspace,
        conversationId,
        source: 'auto',
        tags: ['lesson', ...extraction.tags],
        importance: 8,
      });
    }

    // Learn preferences
    for (const pref of extraction.preferences) {
      learnPreference(pref.category, pref.key, pref.value);
    }

    console.log(`[SessionSummary] Extracted from "${conversation.name}": ` + `summary=${extraction.summary ? 'yes' : 'no'}, ` + `decisions=${extraction.decisions.length}, ` + `lessons=${extraction.lessons.length}, ` + `preferences=${extraction.preferences.length}`);
  } catch (error) {
    console.warn('[SessionSummary] Extraction failed (non-critical):', error);
    reportDegraded('SessionSummary', 'Memory extraction failed', 'degraded');
  }
}

/**
 * Build a compact transcript from messages for the LLM.
 */
function buildTranscript(messages: TMessage[]): string {
  const lines: string[] = [];

  for (const msg of messages) {
    if (msg.type !== 'text') continue;

    const role = msg.position === 'right' ? 'User' : 'Assistant';
    const content = typeof msg.content === 'object' && 'content' in msg.content ? (msg.content as { content: string }).content : '';

    if (!content) continue;

    // Truncate individual messages to keep transcript manageable
    const truncated = content.length > 500 ? content.slice(0, 500) + '...' : content;
    lines.push(`${role}: ${truncated}`);
  }

  return sanitizeForMemory(lines.join('\n\n'));
}

/**
 * Call Gemini Flash to extract structured memories from a conversation transcript.
 */
async function generateExtraction(transcript: string, conversationName: string): Promise<SessionExtractionResult | null> {
  let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    const modelConfig = await ProcessConfig.get('model.config');
    const geminiProvider = modelConfig?.find((p: any) => p.platform?.toLowerCase().includes('gemini') && p.apiKey);
    apiKey = geminiProvider?.apiKey;
  }

  if (!apiKey) return null;

  const prompt = `Analyze this conversation and extract structured memories. Return ONLY valid JSON, no markdown.

Conversation: "${conversationName}"

${transcript}

Return JSON in this exact format:
{
  "summary": "1-3 sentence summary of what happened",
  "decisions": ["decision 1", "decision 2"],
  "lessons": ["lesson learned 1"],
  "preferences": [{"category": "communication", "key": "style", "value": "concise"}],
  "tags": ["tag1", "tag2"]
}

Rules:
- summary: Brief factual summary of the session
- decisions: Architectural or technical decisions made (empty array if none)
- lessons: Mistakes made, corrections, things to remember (empty array if none)
- preferences: Observed user preferences about communication style, tools, patterns (empty array if uncertain)
  - Categories: communication, workflow, tools, code-style, preferences
- tags: 2-5 topic tags for this conversation
- Keep everything concise. Each item should be 1-2 sentences max.
- If the conversation is casual/short, most arrays should be empty.`;

  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      maxOutputTokens: 1000,
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  const text = response.text?.trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as SessionExtractionResult;
    // Validate structure
    if (!parsed.summary || !Array.isArray(parsed.decisions)) return null;
    return {
      summary: String(parsed.summary),
      decisions: (parsed.decisions || []).map(String).slice(0, 5),
      lessons: (parsed.lessons || []).map(String).slice(0, 5),
      preferences: (parsed.preferences || []).slice(0, 10),
      tags: (parsed.tags || []).map(String).slice(0, 5),
    };
  } catch {
    return null;
  }
}
