/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * emberService — Ember's core brain.
 *
 * Smart assistant that runs in the main process.
 * - Classifies user intent (pattern matching + LLM fallback)
 * - Handles simple tasks directly via Gemini Flash
 * - Delegates complex tasks to CLI agents via existing WorkerManage
 * - Enriches every interaction with memory context
 * - Logs all actions to activity feed for transparency
 */

import { GoogleGenAI } from '@google/genai';
import { getDatabase } from '@process/database';
import { buildMemoryContext } from '@process/services/memoryService';
import { buildEmberSystemPrompt, PERSONALITIES, type AutonomyLevel, type EmberPromptContext, type PersonalityId } from './emberPersonality';

// ============================================================
// Types
// ============================================================

export type EmberIntentType =
  | 'direct' // Answer directly via Gemini Flash
  | 'memory' // Store or recall memory
  | 'schedule' // Create/manage scheduled task
  | 'status' // Check project or system status
  | 'route' // Delegate to a CLI agent
  | 'unknown'; // Needs LLM classification

export interface EmberIntent {
  type: EmberIntentType;
  subtype?: string; // e.g., 'store' | 'recall' for memory
  confidence: number; // 0-1
  extractedArgs?: string; // Parsed arguments (e.g., schedule time, memory content)
}

export interface EmberContext {
  workspace?: string;
  conversationId?: string;
  source: 'ui' | 'channel' | 'cron';
  channelPlatform?: string;
  userProfile?: string;
  memories?: string;
  projectContext?: string;
}

export interface EmberResponse {
  text: string;
  intent: EmberIntentType;
  routed?: boolean;
  routedTo?: string;
  activityId?: string;
}

export interface EmberActivity {
  id: string;
  timestamp: number;
  action: string;
  detail: string;
  source: 'ui' | 'channel' | 'cron';
  intent: EmberIntentType;
  success: boolean;
}

export interface EmberConfig {
  personality: PersonalityId;
  autonomy: AutonomyLevel;
  customPrompt?: string;
  enabled: boolean;
}

// ============================================================
// Intent Classification — Pattern Matching (fast path)
// ============================================================

const INTENT_PATTERNS: Array<{ pattern: RegExp; type: EmberIntentType; subtype?: string }> = [
  // Memory: store
  { pattern: /^ember[,:]?\s*(remember|note|save|store|keep in mind)\b/i, type: 'memory', subtype: 'store' },
  { pattern: /\b(remember that|don'?t forget|keep in mind)\b/i, type: 'memory', subtype: 'store' },

  // Memory: recall
  { pattern: /^ember[,:]?\s*(what did|do you remember|recall|what do you know about)\b/i, type: 'memory', subtype: 'recall' },
  { pattern: /\b(what did we decide|what was the|do you remember)\b/i, type: 'memory', subtype: 'recall' },

  // Schedule
  { pattern: /^ember[,:]?\s*(schedule|remind|set a reminder|set an alarm|every day at|every morning)\b/i, type: 'schedule' },
  { pattern: /\b(remind me|schedule a|set a reminder|every \w+ at \d)\b/i, type: 'schedule' },

  // Status
  { pattern: /^ember[,:]?\s*(status|how'?s the|what'?s the status|how is the|progress on)\b/i, type: 'status' },

  // Route: code-related (delegate to CLI agent)
  { pattern: /^ember[,:]?\s*(fix|debug|refactor|write code|implement|build|compile|run tests|deploy)\b/i, type: 'route' },
  { pattern: /\b(fix the bug|write a function|create a component|run the tests|push to|merge the)\b/i, type: 'route' },
];

function classifyByPattern(input: string): EmberIntent | null {
  for (const { pattern, type, subtype } of INTENT_PATTERNS) {
    if (pattern.test(input)) {
      return { type, subtype, confidence: 0.85 };
    }
  }
  return null;
}

// ============================================================
// Service
// ============================================================

class EmberService {
  private activityLog: EmberActivity[] = [];
  private config: EmberConfig = {
    personality: 'bubbly',
    autonomy: 'balanced',
    enabled: true,
  };
  private conversationHistory: Array<{ role: 'user' | 'model'; text: string }> = [];
  private maxHistory = 20;

  // ---- Configuration ----

  getConfig(): EmberConfig {
    return { ...this.config };
  }

  setConfig(updates: Partial<EmberConfig>): void {
    Object.assign(this.config, updates);
  }

  // ---- Intent Classification ----

  async classifyIntent(input: string): Promise<EmberIntent> {
    // Fast path: pattern matching handles ~80% of cases
    const patternMatch = classifyByPattern(input);
    if (patternMatch) return patternMatch;

    // Slow path: LLM classification for ambiguous input
    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        return { type: 'direct', confidence: 0.5 };
      }

      const client = new GoogleGenAI({ apiKey });
      const response = await Promise.race([
        client.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Classify this user message into exactly one category. Respond with ONLY the category name, nothing else.

Categories:
- direct: General question, conversation, advice, writing, research (most messages)
- memory: User wants to store or recall something from memory
- schedule: User wants to set a reminder or scheduled task
- status: User is asking about project or system status
- route: User needs complex code work, deep analysis, or multi-step technical tasks

Message: "${input.substring(0, 500)}"

Category:`,
                },
              ],
            },
          ],
          config: { maxOutputTokens: 10, temperature: 0 },
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);

      if (response && 'text' in response) {
        const category = (response.text ?? '').trim().toLowerCase();
        const validTypes: EmberIntentType[] = ['direct', 'memory', 'schedule', 'status', 'route'];
        if (validTypes.includes(category as EmberIntentType)) {
          return { type: category as EmberIntentType, confidence: 0.75 };
        }
      }
    } catch {
      // Classification failed, default to direct
    }

    return { type: 'direct', confidence: 0.5 };
  }

  // ---- Main Entry Point ----

  async processMessage(input: string, context: EmberContext): Promise<EmberResponse> {
    if (!this.config.enabled) {
      return { text: 'Ember is currently disabled. Enable me in Settings to get started.', intent: 'direct' };
    }

    // Enrich context with memory
    const enrichedContext = await this.enrichContext(context, input);

    // Classify intent
    const intent = await this.classifyIntent(input);

    // Track conversation
    this.conversationHistory.push({ role: 'user', text: input });
    if (this.conversationHistory.length > this.maxHistory) {
      this.conversationHistory.shift();
    }

    let response: EmberResponse;

    switch (intent.type) {
      case 'memory':
        response = await this.handleMemory(input, enrichedContext, intent.subtype);
        break;
      case 'schedule':
        response = await this.handleSchedule(input, enrichedContext);
        break;
      case 'status':
        response = await this.handleStatus(enrichedContext);
        break;
      case 'route':
        response = await this.handleRoute(input, enrichedContext);
        break;
      default:
        response = await this.handleDirect(input, enrichedContext);
        break;
    }

    // Track response
    this.conversationHistory.push({ role: 'model', text: response.text });
    if (this.conversationHistory.length > this.maxHistory) {
      this.conversationHistory.shift();
    }

    // Log activity
    const activity = this.logActivity({
      action: intent.type,
      detail: response.text.substring(0, 200),
      source: context.source,
      intent: intent.type,
      success: true,
    });
    response.activityId = activity.id;

    return response;
  }

  // ---- Handlers ----

  private async handleDirect(input: string, context: EmberContext): Promise<EmberResponse> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return {
        text: 'I need a Gemini API key to respond. You can set one up in Settings → Gemini.',
        intent: 'direct',
      };
    }

    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const messages = [
        { role: 'user' as const, parts: [{ text: systemPrompt + '\n\n---\n\nConversation so far:' }] },
        ...this.conversationHistory.map((m) => ({
          role: m.role as 'user' | 'model',
          parts: [{ text: m.text }],
        })),
      ];

      const client = new GoogleGenAI({ apiKey });
      const response = await Promise.race([
        client.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: messages,
          config: { maxOutputTokens: 2000, temperature: 0.7 },
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
      ]);

      const text = response && 'text' in response ? (response.text ?? '').trim() : '';
      if (!text) {
        return { text: 'I had trouble generating a response. Could you try rephrasing?', intent: 'direct' };
      }

      return { text, intent: 'direct' };
    } catch {
      return { text: 'Something went wrong on my end. Try again in a moment.', intent: 'direct' };
    }
  }

  private async handleMemory(input: string, context: EmberContext, subtype?: string): Promise<EmberResponse> {
    const db = getDatabase();

    if (subtype === 'recall') {
      // Search memory
      const query = input.replace(/^ember[,:]?\s*(what did|do you remember|recall|what do you know about)\s*/i, '').trim();
      const searchResult = db.searchMemories(query, context.workspace, 5);
      const results = searchResult.data ?? [];

      if (results.length === 0) {
        return { text: "I don't have any memories matching that. Could you be more specific?", intent: 'memory' };
      }

      const memoryText = results.map((r: any) => `- ${String(r.content).substring(0, 150)}`).join('\n');

      // Use Gemini Flash to synthesize a natural answer from memories
      const apiKey = await this.getApiKey();
      if (apiKey) {
        try {
          const client = new GoogleGenAI({ apiKey });
          const resp = await client.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: `The user asked: "${input}"\n\nHere are relevant memories:\n${memoryText}\n\nSynthesize a clear, conversational answer from these memories. Be specific and helpful.` }] }],
            config: { maxOutputTokens: 500, temperature: 0.3 },
          });
          const text = resp.text?.trim();
          if (text) return { text, intent: 'memory' };
        } catch {
          // Fall through to raw memories
        }
      }

      return { text: `Here's what I remember:\n${memoryText}`, intent: 'memory' };
    }

    // Store memory
    const content = input.replace(/^ember[,:]?\s*(remember|note|save|store|keep in mind)\s*(that\s*)?/i, '').trim();

    if (!content) {
      return { text: 'What would you like me to remember?', intent: 'memory' };
    }

    db.insertMemoryChunk({
      id: `ember-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      workspace: context.workspace ?? null,
      conversationId: context.conversationId ?? null,
      type: 'fact',
      source: 'user',
      content,
      tags: [],
      importance: 8, // User-explicit memories are high importance
    });

    return { text: `Got it, I'll remember that.`, intent: 'memory' };
  }

  private async handleSchedule(input: string, _context: EmberContext): Promise<EmberResponse> {
    // For Phase 9A: acknowledge and explain. Full CronService integration in 9B.
    return {
      text: `I understand you want to schedule something. Scheduling integration is coming soon — for now, you can use the Cron tab in any conversation to set up recurring tasks. What you said: "${input.substring(0, 100)}"`,
      intent: 'schedule',
    };
  }

  private async handleStatus(context: EmberContext): Promise<EmberResponse> {
    const db = getDatabase();
    const conversations = db.getUserConversations(undefined, 0, 5);
    const recentCount = conversations.data?.length ?? 0;

    const totalResult = db.getMemoryCount();
    const projectResult = context.workspace ? db.getMemoryCount(context.workspace) : null;
    const memoryStats = {
      total: totalResult.data ?? 0,
      project: projectResult?.data ?? 0,
    };

    const parts = [`Here's your current status:`, `- ${recentCount} recent conversations`, `- ${memoryStats.total} memories stored${memoryStats.project ? ` (${memoryStats.project} for current project)` : ''}`];

    if (context.workspace) {
      parts.push(`- Active workspace: ${context.workspace.split(/[/\\]/).pop()}`);
    }

    return { text: parts.join('\n'), intent: 'status' };
  }

  private async handleRoute(input: string, context: EmberContext): Promise<EmberResponse> {
    // For Phase 9A: acknowledge routing intent and suggest using the appropriate agent
    // Full WorkerManage integration comes in Phase 9B
    return {
      text: `That sounds like a task for one of our specialist agents. For code tasks, start a Gemini or Claude Code conversation — I'll be able to route these automatically soon. In the meantime, I can help you think through the approach if you'd like.`,
      intent: 'route',
      routed: false,
    };
  }

  // ---- Context Building ----

  private async enrichContext(context: EmberContext, query: string): Promise<EmberContext> {
    try {
      const memoryCtx = buildMemoryContext({ query, workspace: context.workspace, totalTokens: 2000 });
      if (memoryCtx) {
        // Split into profile and memories sections
        const profileMatch = memoryCtx.match(/## User Profile\n([\s\S]*?)(?=\n## |$)/);
        const memoriesMatch = memoryCtx.match(/## Relevant Memories\n([\s\S]*?)$/);

        return {
          ...context,
          userProfile: profileMatch?.[1]?.trim() || context.userProfile,
          memories: memoriesMatch?.[1]?.trim() || context.memories,
        };
      }
    } catch {
      // Memory enrichment failed, continue without
    }
    return context;
  }

  private buildSystemPrompt(context: EmberContext): string {
    const personality = this.config.personality === 'custom' && this.config.customPrompt ? { ...PERSONALITIES.custom, systemPrompt: this.config.customPrompt } : (PERSONALITIES[this.config.personality] ?? PERSONALITIES.bubbly);

    const promptCtx: EmberPromptContext = {
      personality,
      autonomy: this.config.autonomy,
      userProfile: context.userProfile,
      memories: context.memories,
      projectContext: context.projectContext,
    };

    return buildEmberSystemPrompt(promptCtx);
  }

  // ---- Activity Log ----

  logActivity(data: Omit<EmberActivity, 'id' | 'timestamp'>): EmberActivity {
    const activity: EmberActivity = {
      id: `ember-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      ...data,
    };

    this.activityLog.unshift(activity);
    // Keep last 200 activities in memory
    if (this.activityLog.length > 200) {
      this.activityLog.length = 200;
    }

    return activity;
  }

  getRecentActivity(limit = 20): EmberActivity[] {
    return this.activityLog.slice(0, limit);
  }

  clearActivity(): void {
    this.activityLog = [];
  }

  // ---- Helpers ----

  private async getApiKey(): Promise<string | null> {
    let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      try {
        const { ProcessConfig } = await import('@process/initStorage');
        const modelConfig = await ProcessConfig.get('model.config');
        const geminiProvider = (modelConfig as any[])?.find((p: any) => p.platform?.toLowerCase().includes('gemini') && p.apiKey);
        apiKey = geminiProvider?.apiKey;
      } catch {
        // Config not available
      }
    }

    return apiKey || null;
  }

  resetConversation(): void {
    this.conversationHistory = [];
  }
}

// Singleton
export const emberService = new EmberService();
