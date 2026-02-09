# Foundry — Architecture Decisions Log

> Settled decisions. Don't re-debate these. Override only with explicit discussion.

---

## Core Architecture

### D-001: "Stay thin at agent layer, orchestrate at platform layer"

**Date:** 2026-02-08
**Context:** Tension between "stay thin" principle and Ember (which IS orchestration).
**Decision:** "Stay thin" applies to CLI wrapping only. Foundry doesn't replicate what Gemini CLI / Claude Code already do. Ember is acknowledged as a NEW orchestration layer that adds value ABOVE the CLIs.
**Rationale:** Foundry's unique value = coordination, context, and continuity that no single CLI provides.

### D-002: English-only for now

**Date:** 2026-02-08
**Context:** 6 locale files (ja-JP, ko-KR, tr-TR, zh-CN, zh-TW, en-US) but 12+ new feature surfaces coming.
**Decision:** English-only. Remove unused locale files. Simplify i18n infrastructure.
**Rationale:** Maintaining translations for 12 new features across 6 languages = unsustainable. Add i18n back when features stabilize.

### D-003: Fork @office-ai/aioncli-core

**Date:** 2026-02-08
**Context:** 155+ imports across 54 files. No public source. NPM-only. Breaking changes have occurred.
**Decision:** Fork for trust and transparency (medium-term). Continue as-is for now.
**Rationale:** Can't inspect patches vs upstream Google Gemini CLI. If iOfficeAI stops publishing, we're stuck.

### D-004: DB CHECK → Zod validation

**Date:** 2026-02-08
**Context:** SQLite CHECK constraints (`type IN ('gemini', 'acp', 'codex', 'image')`) can't be ALTERed. Every new agent/channel = table recreation.
**Decision:** Drop all CHECK constraints, validate with Zod at TypeScript layer. One migration, permanent fix.

### D-005: Remove Lark channel

**Date:** 2026-02-08
**Context:** Lark/Feishu is niche Chinese enterprise. Not aligned with target user base.
**Decision:** Remove. Replace with Slack, WhatsApp, Discord, Signal.

---

## Memory & Intelligence

### D-006: Memory stack — sqlite-vec + ONNX + bge-micro-v2

**Date:** 2026-02-08
**Context:** Need local RAG. Options: API-based embeddings, local ONNX, external vector DB.
**Decision:** sqlite-vec (extends existing better-sqlite3) + ONNX Runtime + bge-micro-v2 (22.9MB).
**Rationale:** Zero infrastructure, cross-platform, local-only, aligns with privacy principles.
**Risk:** Native module build pain. MUST spike in Electron Phase 0-1. Fallback: Gemini embeddings API.

### D-007: Hybrid search 70/30 vector/BM25

**Date:** 2026-02-08
**Decision:** 70% vector similarity + 30% BM25 keyword. 512-token chunks at paragraph boundaries.

### D-008: Memory context budget — 15% cap

**Date:** 2026-02-08
**Decision:** Memory injection capped at 15% of agent context budget. Constitution + skills always fit (small). Conversation gets the remainder. Top-K retrieval (K=10-20).

### D-009: User profile learning

**Date:** 2026-02-08
**Decision:** Passive + explicit. Track style, preferences, corrections. "I prefer X" stored immediately. All inspectable/deletable.

---

## Features

### D-010: Stubs (not "Artifacts")

**Date:** 2026-02-08
**Context:** Needed a name for generated content cards in chat.
**Decision:** "Stubs" — a starting point the agent creates that you refine. StubCard (completed) + StubStream (live creation).
**Alternatives considered:** Works, Forged, Crafts, Pieces, Outputs.

### D-011: Constitution enforcement is deep

**Date:** 2026-02-08
**Decision:** Every CLI agent respects the Constitution. CLAUDE.md, Gemini instructions, Codex prompts all carry rules. Settings UI exposes softcoded defaults. Hardcoded boundaries enforced at platform level.

### D-012: Ember = thin assistant

**Date:** 2026-02-08
**Decision:** ~1% of Claude Code's complexity. Assists, doesn't orchestrate (except routing). Not a multi-agent framework.
**Daemon:** Tier 1 (app-bound tray) default. Tier 2 (system daemon) explicit opt-in.

### D-013: All channels = Ember

**Date:** 2026-02-08
**Decision:** When you message on Telegram/Slack/WhatsApp, you're talking to Ember. She routes to agents when needed.

### D-014: TipTap replaces MarkdownEditor

**Date:** 2026-02-08
**Context:** Current "MarkdownEditor" is just CodeMirror with syntax coloring. No WYSIWYG.
**Decision:** TipTap WYSIWYG for documents. CodeMirror stays for source editing. Monaco stays for code.

### D-015: Spark onboarding — no persona

**Date:** 2026-02-08
**Context:** Originally had "Pam PM" persona from Kickstart framework.
**Decision:** Just Spark. No persona. Project assistant role.

### D-016: 50+ project templates

**Date:** 2026-02-08
**Decision:** Pre-built templates for common project types. Claude-generated, human-curated. Competitive edge.

### D-017: Forge IDE integration

**Date:** 2026-02-08
**Decision:** VS Code clone (based on Void). Shares settings with Foundry via `.foundry/`. "Open in Forge" from projects.

---

## Security

### D-018: AES-256-GCM credentials (not Base64)

**Date:** 2026-02-08
**Decision:** Replace Base64 encoding with real encryption using Electron `safeStorage` API.

### D-019: Stronger pairing — 8-char alphanumeric

**Date:** 2026-02-08
**Decision:** Replace 6-digit numeric with 8-character alphanumeric. Rate limit pairing attempts (5/min).

### D-020: Rate limiting — 30/min, 200/hr per user

**Date:** 2026-02-08

### D-021: Session timeout — 24h default

**Date:** 2026-02-08
**Decision:** Auto-expire after configurable inactivity. Default 24 hours.

### D-022: Prompt injection defense layer

**Date:** 2026-02-08
**Decision:** Content filtering that strips injection patterns. Acknowledged: subtle behavioral manipulation via skills is unsolved.

### D-023: Skill security — 3 trust levels

**Date:** 2026-02-08
**Decision:** Bundled (pre-audited) → User-created (self-trusted) → Imported (requires security scan).

---

## Development

### D-024: Claude Code Swarm development

**Date:** 2026-02-08
**Decision:** 4-person Agent Teams (renderer, platform, security, agents). File ownership rules. Plan approval before code.

### D-025: Testing built into every phase

**Date:** 2026-02-08
**Decision:** foundry-tester subagent runs alongside feature agents. Every phase has test requirements.

### D-026: Signal SDK — libsignal-node

**Date:** 2026-02-08
**Decision:** Native. No Java wrapper dependency.

### D-027: Context budget allocator per agent

**Date:** 2026-02-08
**Decision:** Gemini 1M, Claude 200K, Codex 128K. Auto-scales memory vs conversation.

### D-028: Conversation search via FTS5

**Date:** 2026-02-08
**Decision:** Re-add FTS. Search at top level, sub-projects, and within projects.

### D-029: Onboarding — max 7 steps, skippable

**Date:** 2026-02-08
**Decision:** Rerunnable from Settings.

### D-030: Tips — AI-generated, human-curated

**Date:** 2026-02-08
**Decision:** Generate 200+ with Claude, curate to 100-150.

### D-031: Cost management dashboard

**Date:** 2026-02-08
**Decision:** API usage dashboard with per-feature cost breakdown, optional budget limits.

### D-032: Accessibility

**Date:** 2026-02-08
**Decision:** Keyboard nav, screen readers, ARIA, color contrast. Voice adds accessibility layer. Don't kill functionality.

### D-033: Error recovery — every feature has degradation path

**Date:** 2026-02-08
**Decision:** "When X fails, system does Y, user sees Z."
