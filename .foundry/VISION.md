# Foundry Vision — Brainstorming Document

**Date:** 2026-02-08
**Status:** Active brainstorm — living document
**Last Updated:** 2026-02-08 (Session 3 — architectural review + swarm development strategy)

---

## Table of Contents

1. [The Foundry Vision](#1-the-foundry-vision)
2. [Constitution — The Heart of the System](#2-constitution)
3. [Works — Smart Content in Chat](#3-works) _(renamed from "Artifacts")_
4. [Projects — Structured Workspaces with Spark](#4-projects)
5. [Persistent Memory — Cross-Session Knowledge](#5-persistent-memory)
6. [Skill Library & Store](#6-skill-library)
7. [MCP Library & Store](#7-mcp-library)
8. [Ember — Personal Assistant Layer](#8-ember)
9. [Voice Mode](#9-voice-mode) _(NEW)_
10. [Editing Suite — TipTap + Monaco + CodeMirror](#10-editing-suite)
11. [Communication Channels](#11-channels)
12. [Browser Agent](#12-browser-agent) _(NEW)_
13. [UX Polish — Sidebar, Onboarding, Tips](#13-ux-polish) _(NEW)_
14. [Channel Security — Critical Gaps](#14-channel-security) _(NEW)_
15. [Competitive Analysis — OpenClaw & Nanobot](#15-competitive-analysis)
16. [Architecture Principles](#16-architecture-principles)
17. [Implementation Roadmap](#17-roadmap)
18. [Open Questions & Decisions](#18-open-questions)
19. [Architectural Review — Gaps & Risks](#19-architectural-review) _(NEW — Session 3)_
20. [Development Strategy — Claude Code Swarm](#20-swarm-development) _(NEW — Session 3)_
21. [Battle Plan — Overnight Swarm Execution](#21-battle-plan) _(NEW — Session 3)_

---

## 1. The Foundry Vision

Foundry is evolving from a CLI agent wrapper into a **complete AI development platform**. The core identity:

> **Foundry = The workshop where ideas become reality.**
> CLI agents are the tools. Foundry is the workbench, the memory, the safety rails, and the craftsman's assistant.

### What Foundry Already Is

- Unified GUI for Gemini CLI, Claude Code, Codex, Qwen, custom ACP agents
- Conversation management with workspace integration
- Custom tools (web search, web fetch) that fix CLI deficiencies
- Distribution channels (Telegram, Lark)
- WebUI for remote access
- Preset assistants (CoWork, MoltBook, etc.)

### What Foundry Becomes

- **Projects** with structured onboarding (Spark), memory, skills, and knowledge
- **Artifacts** — intelligent content handling in chat
- **Persistent memory** across sessions with local RAG indexing
- **Skill & MCP stores** for discoverable, installable capabilities
- **Constitution-governed** agent behavior with configurable safety rails
- **Ember** — a personal assistant layer that's proactive, not just reactive
- **Rich editing** with TipTap (documents) and Monaco (code)
- **Multi-channel** distribution (add Slack, WhatsApp, Discord)

### The Architectural Principle (Unchanged)

**Stay thin. Don't orchestrate. Enhance.**

- Foundry is the GUI, the memory, the distribution layer
- CLI agents handle their own orchestration
- Foundry fixes deficiencies (web tools) and adds value (projects, memory, editing)
- Never fight upstream — enhance what's there

---

## 2. Constitution — The Heart of the System

### Current State

Two versions exist:

- **In-repo** (`.specify/memory/constitution.md`) — v1.0.0, basic principles, 112 lines
- **New version** (`CONSTITUTION.md`) — v1.0.0 but 522 lines, comprehensive governance

### Analysis of the New Constitution

The new Constitution is genuinely excellent governance documentation. Key sections:

**Principal Hierarchy** (Section 2) — Authority flows: Platform > Workspace Owner > User > Agent. Agents never override higher principals. This maps directly to Foundry's multi-layer architecture.

**Priority Hierarchy** (Section 3):

1. Protect production/data/credentials
2. Maintain code quality and architecture
3. Follow workspace conventions
4. Be genuinely helpful

**Decision Framework** (Section 4) — Five heuristics in order:

1. Senior Engineer Test — would a thoughtful senior be comfortable?
2. Reversibility Preference — prefer undoable actions
3. Action Asymmetry — bold internally, cautious externally
4. Resourceful Before Asking — exhaust available info first
5. Population-Level Thinking — design for 1,000 devs, not edge cases

**Action Classification** (Section 7):

- Auto-Proceed: read, analyze, generate, lint, test, search
- Confirm: delete, modify shared resources, git push, deploy, external API calls
- Never Execute: credential exposure, bypass security, obfuscated commands

**Memory Tiers** (Section 10.2) — Maps perfectly to Foundry's planned architecture:

- Session Memory (ephemeral) → current conversation context
- Project Memory (persistent, workspace-scoped) → `.foundry/memory/`
- Activity Log (append-only audit) → `.foundry/logs/`

**Honesty Principles** (Section 8) — Non-sycophantic, calibrated confidence, forthright about risks. This aligns with the CLAUDE.md operating principles.

### Integration Plan

The Constitution becomes a **first-class settings surface** in Foundry:

**Phase 1: Ship It**

- Replace `.specify/memory/constitution.md` with the new version
- Store as `constitution.md` in a well-known location (`.foundry/constitution.md` for projects, app-level default)
- Load into agent system prompts as governance context

**Phase 2: Settings UI**

- New "Constitution" tab in Settings (or section within System settings)
- Read-only view of the active constitution with syntax highlighting
- Shows version, last amended date, active/inactive status
- "Human-only" badge — UI clearly indicates only humans can edit

**Phase 3: Softcoded Defaults UI**

- Section 6 of the Constitution defines configurable defaults
- Build a settings panel for the softcoded defaults:
  - Communication: verbosity, explanation depth, code comments, progress updates
  - Operations: confirmation threshold, test requirements, code style, dependency management, git behavior
  - Safety: file deletion, environment detection, secret scanning, backup before modify
- Each setting shows: current value, default, adjustable range
- Workspace-level overrides possible for projects

**Phase 4: Action Classification Enforcement**

- Section 7 defines auto-proceed/confirm/never actions
- Map to Foundry's existing approval system (GeminiApprovalStore, etc.)
- Constitution's classification becomes the default policy
- Workspace owner can adjust via softcoded defaults

**Phase 5: Activity Log**

- Section 10.2 specifies an append-only activity log
- Implement as `.foundry/logs/activity.jsonl` in project workspaces
- Records: action, decision rationale, timestamp, outcome
- Viewable in UI, exportable, deletable by workspace owner

### Key Insight

The Constitution's enforcement model (Appendix A) explicitly says behavioural constraints alone are insufficient — platform architecture must enforce boundaries. This validates Foundry's approach: the Constitution shapes agent behavior via system prompts, while the platform (approval gates, sandboxing, credential isolation) enforces limits architecturally.

---

## 3. Stubs — Smart Content in Chat

_Generated content in chat = Stubs. A stub is a starting point — something the agent creates that you can refine, expand, or use as-is. "Here's your stub: Apple.md."_

### The Full Vision

**During creation** — Live compressed view:

- Agent generates content → user sees it being filled in, in a collapsible box
- Box shows live content streaming in, with max-height constraint
- Can expand to watch full creation, or leave collapsed
- Progress indicator: "Creating Apple.md..." with live line count

**After creation** — File card presentation:

- Content settles into a clean clickable file card in chat
- Card shows: filename, file type icon, line count, size
- "Here's your Apple.md" — clean, scannable
- Multiple files = multiple cards, stacked or in a row

**Interaction:**

- Click card → opens in Preview panel (TipTap for MD, Monaco for code, rendered for HTML)
- Copy button → clipboard
- Download button → save file dialog
- If multiple files → "Download All" packages as zip
- Files also visible in workspace file viewer

**Code blocks (not files):**

- Short code (<20 lines) → inline with syntax highlighting + copy button
- Medium code (20-50 lines) → auto-collapsed with gradient fade + "Show more"
- Long code (50+ lines) → compact card → opens in Preview with Monaco

### Naming Alternatives Considered

| Name        | Verdict                                            |
| ----------- | -------------------------------------------------- |
| **Works**   | Recommended — on-brand, clean, "Foundry works"     |
| **Forged**  | Strong — "Here's your forged report" sounds badass |
| **Crafts**  | Warm — "Here's your crafted report"                |
| **Pieces**  | Neutral — "3 pieces created"                       |
| **Outputs** | Generic — functional but bland                     |

### Technical Implementation

- `Markdown.tsx` CodeBlock — line counting + threshold branching for code blocks
- NEW `StubCard.tsx` — file card component (inline styles for Shadow DOM)
- NEW `StubStream.tsx` — live creation view (collapsible streaming content)
- `emitter.emit('preview.open', ...)` — already works for Preview integration
- Streaming detection: use message status `'work'` vs `'finish'`
- Multiple works: stack cards, "Download All" button when count > 1

### Reusable Existing Code

- `PreviewContext` / `usePreviewLauncher` — bridges to Preview panel
- `CollapsibleContent.tsx` — gradient fade + expand pattern
- Preview panel — download, edit, history, multi-tab all exist

---

## 4. Projects — Structured Workspaces with Spark

### Core Concept

A **project** = a workspace with a `.foundry/` folder. Detection is filesystem-based. No new conversation type. No database migration.

```
workspace/
  .foundry/
    project.json          # Metadata: name, description, goals, type, created
    constitution.md       # Project-level constitution (optional override)
    instructions.md       # Agent instructions (like CLAUDE.md)
    prd.md               # PRD generated during Spark
    chips/               # Selected domain expertise files
      clear-communication.md
      web-application.md
    skills/              # Project-specific skills
    memory/              # Session summaries, learnings, patterns
      session-2026-02-08.md
    logs/                # Activity log (append-only)
      activity.jsonl
  (project files...)
```

### Entry Points

1. **"New Project" button** — sidebar dropdown or dedicated button
2. **"Promote to Project"** — any existing conversation with a workspace can become a project
3. **Home page cards** — 2 rows of 3, showing recent projects with name, description, last active

### Spark — The Onboarding Flow

Spark is the Foundry Kickstart framework (Pam PM persona, 13-phase discovery) adapted for in-app use.

**The Experience:**

1. User clicks "New Project" → mini wizard (name, description, workspace, project type)
2. Foundry creates `.foundry/project.json` immediately (workspace is now a project)
3. A new Gemini conversation opens with the Spark preset loaded
4. Pam guides the user through discovery phases:
   - Idea → Audience → Classification → Purpose → Experience → Scope → Format → Inspiration → Quality → Risks → Constraints → Tools → Pre-Flight
5. During discovery, Pam announces which chips apply ("Loading web-application chip...")
6. After discovery, the agent generates: PRD, instructions.md, selected chips copied to `.foundry/chips/`

**Language:** "Spark" is a verb. "Let's Spark this out." "Spark a new project." "Run Spark on this workspace."

**Implementation:**

- Builtin preset: `assistant/foundry-spark/spark.md` (Pam rules)
- Chip library: `assistant/foundry-spark/chips/*.md` (30+ files, loaded selectively)
- Ships with the app, registered in `assistantPresets.ts`

### Context Loading

When an agent starts in a project workspace:

1. Load `.foundry/instructions.md` → prepend to system prompt
2. Load `.foundry/chips/*.md` → append as domain expertise
3. Load `.foundry/memory/*.md` → append as session context (capped at ~50KB)
4. Constitution enforcement from `.foundry/constitution.md` or app default

This works across all agent types (Gemini, ACP, Codex) by hooking into `BaseAgentManager` or agent-specific managers.

### Multi-Chat in Projects

Like Claude.ai Projects, a project workspace can have multiple conversations:

- All conversations share the same `.foundry/` context
- Each conversation has its own session memory
- Agent writes session summaries to `.foundry/memory/` after significant interactions
- Home page shows project card → clicking opens a project view with all conversations listed

### Project Templates — Guided Creation Edge

**50+ pre-built templates** for common project types. Templates are like skills but for project structure — they define `.foundry/` configuration, initial instructions, recommended skills, and Spark discovery paths.

**Template categories:**

| Category      | Examples                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------- |
| **Software**  | SaaS app, micro-SaaS, CLI tool, API service, browser extension, mobile app, VS Code extension |
| **Web**       | Landing page, e-commerce, blog, portfolio, documentation site, web app                        |
| **Content**   | Book writing, technical docs, blog series, newsletter, course creation                        |
| **Marketing** | Campaign planner, social media strategy, SEO content, product launch                          |
| **Business**  | Business plan, pitch deck, market research, financial model, competitive analysis             |
| **Creative**  | Video production, podcast, music project, game design, art portfolio                          |
| **Data**      | Data analysis, ML model, data pipeline, dashboard, research paper                             |
| **DevOps**    | CI/CD pipeline, infrastructure, monitoring, security audit, migration plan                    |

**Template format:**

```
templates/
  saas-app/
    project.json        # Pre-configured project metadata + type
    instructions.md     # Agent guidance for SaaS development
    skills.json         # Recommended skills to auto-load
    spark-config.json   # Pre-answered Spark phases (skip known answers)
    README.md           # What this template includes
```

**Template UX:**

- "New Project" → "Start from template" or "Start blank"
- Template browser with search, categories, descriptions
- One-click: creates workspace, copies template files, opens Spark (with pre-answered phases)
- Templates are exportable and shareable (zip format)

**Content generation:** Use Claude to generate 50+ templates, then human-curate for quality. Each template = ~5 files, minimal size, maximum guidance.

### Forge IDE Integration

**Forge** is a VS Code clone based on Void, part of the Foundry ecosystem. Foundry and Forge share settings and can be used together:

- **Shared settings framework:** API keys, model preferences, Constitution — configured once, used by both
- **"Open in Forge"** button on project workspace → launches Forge with project context
- **Foundry = command center**, Forge = hands-on IDE
- Forge is the IDE layer; Foundry is the orchestration/management layer
- Users who want a full IDE experience use Forge inside their projects
- Users who just want AI chat + management stay in Foundry

**Implementation:** Settings sync via shared electron-store or filesystem-based config. `.foundry/` folder is the common context both apps read.

---

## 5. Persistent Memory — Cross-Session Knowledge ("Our Jarvis")

### The Problem

Every conversation starts fresh. The agent has no memory of previous sessions, user preferences, project history, or lessons learned. Users repeat themselves constantly.

### Research Findings

**Recommended Stack: sqlite-vec + ONNX Runtime**

| Component      | Choice                          | Rationale                                                            |
| -------------- | ------------------------------- | -------------------------------------------------------------------- |
| Vector storage | **sqlite-vec**                  | Works with existing better-sqlite3, single file, zero infrastructure |
| Embeddings     | **ONNX Runtime + bge-micro-v2** | 22.9MB model, runs locally, cross-platform, no GPU needed            |
| Chunking       | 512 tokens                      | Optimal for bge-micro-v2, paragraph-level granularity                |
| Search         | Hybrid (70% vector + 30% BM25)  | Balances semantic similarity with keyword precision                  |

**Why This Stack:**

- Foundry already uses better-sqlite3 — sqlite-vec is a natural extension
- ONNX Runtime is cross-platform (macOS, Windows, Linux) with native builds
- bge-micro-v2 is tiny (22.9MB) but effective for code/documentation search
- No external services, no API costs, no network dependency
- Everything runs locally — aligns with Constitution's privacy principles

### Memory Architecture (Aligned with Constitution Section 10)

**Tier 1: Session Memory** (ephemeral)

- Current conversation context
- Working state, tool results, intermediate outputs
- Discarded when conversation ends (existing behavior)

**Tier 2: Project Memory** (persistent, workspace-scoped)

- `.foundry/memory/` — session summaries, decisions, patterns, lessons
- `.foundry/instructions.md` — agent guidance
- Vector-indexed for semantic search
- Scoped to workspace — no cross-workspace leakage
- User can inspect, export, delete at any time

**Tier 3: Global Memory — User Profile** (persistent, app-level)

- User preferences, communication style, common patterns
- Cross-project knowledge (e.g., "user prefers TypeScript", "user uses Prettier")
- **Personality adaptation** (see below)
- Stored in app-level SQLite with vector index
- User has full control: inspect, export, selective delete

**Tier 4: Activity Log** (append-only audit)

- `.foundry/logs/activity.jsonl` per project
- What was done, why, what was considered, what was rejected
- Cannot be modified by agents
- Provides audit trail for human review

### Personality Adaptation (The "Jarvis" Factor)

The memory system doesn't just remember facts — it learns the user:

**User Profile Memory:**

- Communication preferences: formal/casual, verbose/concise, technical depth
- Working patterns: when they work, what they work on, how they approach problems
- Emotional calibration: detect frustration vs exploration vs flow state
- Terminology: what they call things, their mental models, their shorthand
- Decision history: what they chose when given options, risk tolerance
- Corrections: when user rewrites an agent response, learn the delta

**How it learns (passively + explicitly):**

- Passive: track style, response preferences, corrections over time
- Explicit: "I prefer X" → stored immediately in user profile
- Feedback loops: rewritten responses analyzed for preference signals
- Ember coordinates: personality data available to all agents in all sessions

**The "never forgetful" principle:**
Ember must remember. A forgetful assistant is a failed assistant. Memory model uses fast/cheap model (Gemini Flash) for memory operations — speed and cost efficiency. But memory is ALWAYS consulted. Every conversation start loads relevant memories. Every agent has access to user profile.

### How It Works

**Ingestion (after each conversation):**

1. Agent generates session summary (key decisions, code changes, learnings)
2. Summary is chunked (512 tokens) and embedded via ONNX Runtime
3. Vectors stored in sqlite-vec, metadata in SQLite
4. Raw markdown stored in `.foundry/memory/session-{date}.md`
5. Personality observations extracted and stored in user profile

**Retrieval (at conversation start):**

1. Load user profile (always, every conversation)
2. Load project context (instructions, skills, recent memory)
3. When user sends a message, embed the query
4. Search project memory + global memory via hybrid search
5. Top-K relevant memories injected into agent context
6. Agent sees: user profile + relevant memories + project context

**Proactive Memory:**

- At session end, agent suggests: "Should I remember [X] for future sessions?"
- User can approve/edit/reject memories
- Critical decisions auto-logged to activity log
- Personality observations logged silently (user can inspect/delete anytime)

### Scaling — Context Doesn't Get Lost

As projects grow (100K+ lines, 50+ sessions), RAG handles it:

- Not everything loads into context — semantic search surfaces the most relevant
- Instructions + skills = always loaded (they're small, curated)
- Memory = top-K relevant per query (not full history dump)
- Activity log = searchable but not auto-loaded
- This is fundamentally better than Claude.ai's static file approach

### Privacy & Security (Constitution Compliance)

- Credentials NEVER enter memory (Constitution 5.1, 10.3)
- Cross-workspace access prohibited (Constitution 10.3)
- User can delete any memory at any time (Constitution 10.3)
- No reconstruction of deleted memories (Constitution 10.3)
- All memory processing is local — no external API calls
- User profile inspectable, editable, deletable: Settings → Memory → User Profile

---

## 6. Skill Library & Store

### What Are Skills?

Skills are structured expertise that agents can apply. Currently in Foundry: CoWork, MoltBook, Social Job Publisher, UI/UX Pro Max, etc. Each skill = markdown rules + optional scripts.

### Current State

- Skills defined in `assistant/` directory
- Registered in `assistantPresets.ts`
- Loaded as `ruleFiles` and `skillFiles` into agent context
- `AcpSkillManager.ts` handles skill file management

### Skill Format — Hybrid Approach

**Standard skills** = pure Markdown (compatible with Claude, OpenClaw, any system):

```markdown
# Web Application Expert

You are an expert in web application development...
```

**Enhanced Foundry skills** = Markdown with optional YAML frontmatter:

```markdown
---
name: Web Application Expert
version: 1.0.0
category: software
requires: [clear-communication]
foundry_enhanced: true
security_audited: true
---

# Web Application Expert

You are an expert in web application development...
```

**Compatibility principle:**

- Any `.md` skill from anywhere works in Foundry (just markdown content)
- Foundry-enhanced skills have optional frontmatter (metadata, dependencies, security flags)
- Import from Claude/OpenClaw/anywhere → just works
- Export from Foundry → standard markdown, universally compatible
- "Generate a skill" via Claude → produces Foundry-compatible `.md`

### Skill Security Audit (Critical)

Imported skills are untrusted code injection vectors. Security model:

**Trust Levels:**

1. **Bundled** (Foundry-signed) — ships with app, pre-audited
2. **User-created** (self-trusted) — user wrote it, their responsibility
3. **Imported** (untrusted) — requires security audit before activation

**Security Scan on Import:**

- Shell commands, system calls, encoded payloads, base64 blobs
- Prompt injection patterns: "ignore previous instructions", "override system prompt"
- URL payloads pointing to suspicious domains
- Excessive permission requests
- Constitution conflict detection (skills that violate hardcoded boundaries → auto-reject)

**Import Flow:**

1. User imports skill file
2. Foundry scans content, flags suspicious patterns
3. Preview shows skill content with flagged sections highlighted in red
4. User approves or rejects
5. Approved skills get `security_audited: true` in frontmatter

### Vision: A Skill Store

**Bundled Skills** (ship with Foundry):

- Spark (project onboarding)
- CoWork, MoltBook, etc. (existing presets)
- Domain expertise from the chip library (30+ areas, now called "skills")
- Common development skills (code review, testing, debugging, documentation)

**User-Created Skills:**

- Any `.md` file can be a skill
- Drag-and-drop into a project's `.foundry/skills/` directory
- Or add globally via Settings → Skills
- "Generate a skill" button → uses Claude to create from description
- Skills are portable — export as `.md` or `.zip` bundle

**Skill Store (future):**

- Browse/search community skills
- One-click install with security audit
- Version management, ratings, descriptions
- GitHub repo with curated index (initially)
- Similar to OpenClaw's ClawHub but content-first, not code-first

### Skill Auto-Detection & Suggestions

**During Spark:** Analyzes project and suggests skills:

- "This looks like a web application — loading web-application and clear-communication skills"
- "I see React in your package.json — would you like the React patterns skill?"

**During chat:** Context-aware suggestions:

- "This task would benefit from the API design skill. Load it?"
- Auto-accept option in settings (adapting to user over time)

**Per-agent skill injection:**

- Claude Code → skills referenced via `.foundry/instructions.md` which points to `CLAUDE.md`
- Gemini CLI → skills loaded as `presetRules` in system prompt
- Codex → skills loaded via system prompt injection
- All agents guided by `.foundry/` folder contents

### Skill Management UI

- Settings → Skills tab
- List of installed skills (bundled + user-added + store-installed)
- Enable/disable per project or globally
- Skill detail view: description, contents, which projects use it
- Import/Export/Generate buttons
- Security audit status badge per skill

---

## 7. MCP Library & Store

### Current State

- Foundry already supports MCP via `McpService.ts`, `McpOAuthService.ts`
- Agent-specific MCP bridges: `GeminiMcpAgent.ts`, `ClaudeMcpAgent.ts`, `CodexMcpAgent.ts`, etc.
- Manual configuration via Settings → Tools
- Users must know server names, URLs, configurations

### Vision: MCP Store

**Discovery:**

- Curated MCP server directory (pulled from community lists)
- Search by name, category, capability
- Show: description, required config, compatibility (which CLI agents support it)

**One-Click Install:**

- Select MCP server from store
- Foundry handles: download, configuration, environment variables
- Auto-configures for all compatible agents
- Health check / connection test built-in

**Categories:**

- Development: GitHub, GitLab, Jira, Linear, Sentry
- Data: Postgres, MongoDB, Redis, Elasticsearch
- Communication: Slack, Discord, Email, Telegram
- Cloud: AWS, GCP, Azure
- AI: Other model providers, specialized tools
- Productivity: Calendar, Tasks, Notes, Documents

**Sources for MCP Index:**

- `awesome-mcp-servers` GitHub repos
- Anthropic's official MCP server list
- Community submissions
- Self-hosted servers (user adds URL)

### MCP Management UI

- Settings → MCP/Connectors tab (enhanced from current Tools tab)
- "Store" section: browse, search, install
- "Installed" section: status, health, config, enable/disable
- Per-project MCP configuration in `.foundry/mcp.json`
- Global vs project-level MCP servers

---

## 8. Ember — Personal Assistant Layer

### Concept

Ember is Foundry's **thin personal assistant**. Named after the persistent glow of hot coals — always warm, always ready. Not a new agent type, but a **lightweight layer on top** of all of Foundry.

**Core identity: Assistant first, orchestrator only when needed.**
Ember is ~1% of what Claude Code is. She's a helpful, personality-driven assistant who happens to be able to coordinate CLI agents when the user asks. She doesn't try to be a multi-agent framework — she's a friendly face on top of Foundry's capabilities.

**Ember is:**

- A persistent personal assistant that lives across ALL of Foundry
- Available via desktop app AND channels (Telegram, Slack, WhatsApp, Discord, Signal)
- **Thin** — handles quick tasks herself, routes complex work to CLI agents
- Proactive but respectful — works in background, surfaces when useful
- The "glue" between projects, agents, memory, and channels
- Invokable in any chat: "Ember, schedule this" / "Ember, remember this"
- Has a personality (bubbly default, customizable in settings)
- Tied to persistent memory — she NEVER forgets

**Ember is NOT:**

- A heavyweight orchestration framework (she's thin and focused)
- A separate app or daemon (lives in Electron main process + CronService)
- An always-on-screen element (background unless summoned)
- A replacement for CLI agents (she assists, they execute)
- Unconstrained by default (Constitution governs her, with opt-in "Free Reign")

### The Channel Experience

When you message on Telegram/Slack/WhatsApp — you're talking to **Ember**. She:

1. Receives your message
2. Checks memory for context ("what were we working on?")
3. Routes to the right agent if needed (Gemini for code, Claude for writing)
4. Or handles it herself for quick tasks (scheduling, reminders, lookups)
5. Responds with her personality, via text or voice note

### The "Ember, can you..." Pattern

- In any chat: `"Ember, add this to my schedule"` → CronService
- In any chat: `"Ember, remember that I prefer TypeScript"` → Global Memory
- In any chat: `"Ember, what did we decide about the auth module?"` → Memory search
- In a project: `"Ember, which skills should I load?"` → Skill analysis
- Via Telegram: `"Ember, how's the build going?"` → Project status check
- Via Slack: `"Ember, book me a flight to NYC"` → Browser agent delegation

### Autonomy Levels (Constitution Section 6 Extension)

| Level          | Behavior                                       | Default                     |
| -------------- | ---------------------------------------------- | --------------------------- |
| **Guided**     | Confirms everything, maximum safety            | First-time users            |
| **Balanced**   | Routine tasks autonomous, risky ones confirmed | Default after onboarding    |
| **Free Reign** | Acts proactively with minimal confirmation     | Opt-in, with clear warnings |

Free Reign warning: "Free Reign mode reduces safety checks. You're trusting Ember to act on your behalf. Hardcoded boundaries (Constitution Section 5) still apply."

### Personality System

- **Default:** Bubbly, warm, helpful (the Ember glow)
- **Customizable:** Settings → Ember → Personality profile
- **Options:** Professional, Casual, Minimal, Custom prompt
- **Voice personality:** Tied to TTS voice selection (ElevenLabs voice ID)
- **Consistency:** Personality persists across channels and sessions

### Trust Psychology

Users trust assistants that:

1. Explain what they did and why (Constitution Section 8: Transparency)
2. Admit mistakes immediately (Constitution Section 12: Error Handling)
3. Remember preferences without being told twice (Persistent Memory)
4. Never surprise with irreversible actions (Constitution Section 4.2: Reversibility)
5. Let the user feel in control always (Constitution Section 1: Core Contract)

### Implementation Phases

**Phase 1: Session Continuity** (low effort, high value)

- On conversation open, load relevant memory → "Welcome back" context
- Show last session summary, open TODOs, recent changes
- Ember greets returning users with relevant context

**Phase 2: Background Intelligence**

- CronService-based scheduled tasks
- Daily briefing: "Good morning. Project X has 3 TODOs. You were working on auth."
- Stale TODO alerts, project health checks
- Delivered as home page cards or notifications

**Phase 3: In-Chat Assistance**

- "Ember, ..." invocation in any chat
- Scheduling, memory, skill suggestions, project status
- Routes complex tasks to appropriate CLI agent

**Phase 4: Channel Integration**

- Ember IS the personality across all channels
- Text + voice note responses
- Cross-channel continuity (start on desktop, continue on Telegram)

**Phase 5: Proactive Automation**

- Background analysis of project state
- Auto-suggest skills, flag issues, recommend next steps
- "While I was at it" for safe, reversible actions (auto-format, auto-lint)
- Never for destructive or external actions (Constitution)

### Daemon Architecture — The Safe Way

**Why Ember needs to be a daemon:**
She needs to be alive when the computer is on — checking channels, processing memories, generating briefings, responding to Telegram messages. If she only exists when the Foundry window is open, she's not really an assistant.

**The OpenClaw cautionary tale:**
OpenClaw's daemon is a security disaster: plaintext credentials, unauthenticated WebSocket (CVE-2026-25253), full system access, 230+ malicious packages. XDA, Tenable, Cisco, Vectra AI all recommend against it. The problem isn't the daemon concept — it's the default-insecure implementation.

**Ember's daemon architecture (two tiers):**

**Tier 1: App-Bound Background (default)**

- Ember runs as `utilityProcess` within Electron
- Window close → minimize to system tray (Ember keeps running)
- Tray icon shows Ember status (active/sleeping/processing)
- Background: check channels, poll messages, generate briefings, process memories
- Dies when you quit Foundry from tray (user always has kill switch)
- No system service installation required

**Tier 2: True System Daemon (explicit opt-in)**

- User explicitly enables: Settings → Ember → "Keep running when Foundry is closed"
- Registers as: launchd agent (macOS), systemd user unit (Linux), scheduled task (Windows)
- Survives app close, survives reboots
- Lightweight: only the Ember worker runs, not full Electron UI
- On user interaction (notification click) → launches full Foundry UI

**Security model (anti-OpenClaw):**

| Principle             | Implementation                                                   |
| --------------------- | ---------------------------------------------------------------- |
| Opt-out security      | Secure by default. Free Reign is opt-in with warnings            |
| Encrypted credentials | AES-256-GCM with machine-derived key. NEVER plaintext            |
| Sandboxed access      | Only conversation cache + channel APIs + memory DB               |
| Full audit logging    | Every action logged to `.foundry/logs/ember.jsonl`               |
| Per-action consent    | Destructive/external actions require approval (Constitution 7.2) |
| Visible status        | Tray icon, status dashboard, activity replay                     |
| Easy kill switch      | Tray → Quit, or Settings toggle                                  |
| Token lifecycle       | Auto-expire, refresh on use, never stored permanently            |
| Process isolation     | Ember worker has no access to file system beyond its scope       |

**AonUI's approach for reference:**
AonUI integrated OpenClaw via WebSocket gateway — treating it as an external service, not a local daemon. They use Ed25519 device identity for auth. We take the opposite approach: Ember is deeply integrated (not external), but follows the same auth rigor.

---

## 9. Voice Mode

### Vision

Ember communicates via voice — not just text. Voice notes on Telegram, voice input on desktop, voice responses that match Ember's personality.

### Architecture

**Speech-to-Text (STT):**

- **OpenAI Whisper API** — user already has OpenAI key, Whisper is included in the API
- Receives voice messages from channels or desktop microphone
- Transcribes → text → routed to agent/Ember as normal

**Text-to-Speech (TTS):**

- **ElevenLabs** — premium voice quality, personality-matched voices
- **OpenAI TTS** — bundled option (included with OpenAI key)
- Agent/Ember generates text response → TTS converts → voice note sent back

**Desktop Voice:**

- Microphone button in SendBox
- Hold-to-record or toggle mode
- Whisper transcribes locally or via API
- Option: voice response playback (TTS)

**Channel Voice:**

- Telegram already handles voice messages (type system supports `voice` content type)
- Receive voice → Whisper transcribes → agent processes → TTS → send voice note back
- Same flow for Slack, WhatsApp, Discord, Signal

**Ember's Voice Personality:**

- Settings → Ember → Voice Profile
- Select ElevenLabs voice ID or OpenAI voice preset
- Voice matches Ember's text personality (bubbly, professional, etc.)
- Consistent across channels

**Future: Phone Calls**

- Twilio integration for actual phone calls
- Ember can call or be called
- Full conversational voice AI
- Phase 5+ roadmap item

### Current State (What Exists)

- Telegram plugin already receives voice messages (`message:voice` handler)
- Unified message type includes `voice` and `audio` content types
- `IUnifiedAttachment` has `duration` field for audio
- NO TTS/STT services exist yet — all infrastructure needed

---

## 10. Editing Suite — TipTap + Monaco + CodeMirror

### Three Editors, Three Purposes

| Editor         | Purpose                   | Format                   | Where                                             |
| -------------- | ------------------------- | ------------------------ | ------------------------------------------------- |
| **TipTap**     | WYSIWYG document editing  | Markdown, rich text      | PRDs, instructions, notes, READMEs, Works preview |
| **Monaco**     | Code editing/viewing      | Any programming language | Code files, configs, standalone viewer            |
| **CodeMirror** | Source editing in Preview | HTML, text               | Preview panel split-view editing                  |

### Current State (What's Actually There)

**Existing editors (ALL CodeMirror-based, NO WYSIWYG):**

| Component            | Tech                                     | What It Does                                        |
| -------------------- | ---------------------------------------- | --------------------------------------------------- |
| `TextEditor.tsx`     | CodeMirror (no syntax)                   | Plain text with line numbers                        |
| `MarkdownEditor.tsx` | CodeMirror + `@codemirror/lang-markdown` | Markdown **syntax highlighting only** — NOT WYSIWYG |
| `HTMLEditor.tsx`     | CodeMirror + `@codemirror/lang-html`     | HTML source code editing                            |

**Also: Monaco in `HTMLViewer.tsx`** — standalone HTML preview uses Monaco for edit mode. Architectural inconsistency (HTMLEditor uses CodeMirror, HTMLViewer uses Monaco).

**Bottom line:** The "MarkdownEditor" is misleading — it's a code editor that colors markdown syntax. You edit raw `# Heading\n**bold**`. There is NO rich text editing anywhere.

### TipTap Integration

**What:** ProseMirror-based WYSIWYG. v3.19.0. `@tiptap/react`. ~100-150KB gzipped. Headless (we style it).

**What TipTap replaces:**

- `MarkdownEditor.tsx` (CodeMirror) → TipTap WYSIWYG for document editing
- `MarkdownViewer` (read-only) → TipTap can be read-only OR editable (unified component)
- Split-screen markdown editing → single TipTap pane (WYSIWYG = no need for preview split)

**What stays:**

- `TextEditor.tsx` (CodeMirror) — generic text, no WYSIWYG needed
- `HTMLEditor.tsx` (CodeMirror) — HTML source editing
- Monaco in HTMLViewer — code viewing

**Key Extensions (all MIT/free):**

_Core (always been free):_

- `@tiptap/starter-kit` — essentials bundle (bold, italic, headings, lists, etc.)
- `@tiptap/extension-markdown` — markdown import/export (critical)
- `@tiptap/extension-code-block-lowlight` — syntax-highlighted code blocks
- `@tiptap/extension-table` — table editing
- `@tiptap/extension-image` — inline images
- `@tiptap/extension-link` — hyperlinks
- `@tiptap/extension-placeholder` — placeholder text
- `@tiptap/extension-character-count` — character/word counting

_Newly open-sourced (MIT, previously paid):_

- `@tiptap/extension-drag-handle` — drag to reorder blocks
- `@tiptap/extension-unique-id` — unique IDs for blocks
- `@tiptap/extension-file-handler` — drag-and-drop file handling
- `@tiptap/extension-table-of-contents` — auto-generated TOC
- `@tiptap/extension-details` + `details-content` + `details-summary` — collapsible sections
- `@tiptap/extension-mathematics` — math rendering (LaTeX)
- `@tiptap/extension-emoji` — emoji support
- `@tiptap/extension-invisible-characters` — show/hide whitespace

_Paid (evaluate later):_

- AI Toolkit — AI-powered text generation within editor
- Pages — page break/pagination
- Conversion — DOCX import/export

_Community:_ [awesome-tiptap](https://github.com/ueberdosis/awesome-tiptap) — additional community extensions

**Where TipTap Appears:**

- Preview panel: markdown files open in TipTap WYSIWYG (replaces CodeMirror markdown editor)
- Works preview: click a generated `.md` work → TipTap for rich viewing/editing
- Project view: edit instructions.md, PRD, session notes with WYSIWYG
- Standalone: New → Document (alongside New → Chat, New → Project)

### Editing Flow (Updated)

1. Agent generates a file → appears as Stub card in chat
2. Click Stub card → opens in Preview panel
3. Preview detects file type:
   - Markdown/text → **TipTap WYSIWYG** (rich editing, no split needed)
   - Code → **Monaco** (syntax highlighting, find/replace, minimap)
   - HTML → rendered preview with "Edit" toggle to Monaco/CodeMirror
4. Changes save back to workspace
5. Version history via Preview's existing history system

---

## 11. Communication Channels

### Current State

- **Telegram** — `TelegramPlugin.ts`, `TelegramAdapter.ts` _(keep)_
- **Lark (Feishu)** — `LarkPlugin.ts`, `LarkAdapter.ts` _(REMOVE — niche Chinese enterprise)_

### Target Channels

| Channel      | SDK                              | Priority | Use Case                 |
| ------------ | -------------------------------- | -------- | ------------------------ |
| **Telegram** | `telegraf` (existing)            | Existing | Personal, dev community  |
| **Slack**    | `@slack/bolt`                    | P0       | Enterprise, teams        |
| **WhatsApp** | WhatsApp Business API            | P1       | Personal, mobile-first   |
| **Discord**  | `discord.js`                     | P2       | Developer community      |
| **Signal**   | `signal-cli` or `libsignal-node` | P2       | Security-conscious users |

### Channel = Ember

Every channel is Ember. When you message on Telegram, you're talking to Ember. She:

- Routes to appropriate agent when needed
- Handles quick tasks herself
- Responds with personality (text or voice)
- Maintains cross-channel continuity

### Channel Architecture

```
src/channels/plugins/
  telegram/    # TelegramPlugin extends BasePlugin (existing)
  slack/       # SlackPlugin extends BasePlugin (NEW)
  whatsapp/    # WhatsAppPlugin extends BasePlugin (NEW)
  discord/     # DiscordPlugin extends BasePlugin (NEW)
  signal/      # SignalPlugin extends BasePlugin (NEW)
```

Each implements: `onInitialize`, `onStart`, `onStop`, `sendMessage`, `editMessage`, `getActiveUserCount`, `getBotInfo`, `testConnection`

---

## 12. Browser Agent — Built Into Architecture

### Design Principle

Browser manipulation is a **first-class capability**, not a bolt-on. Even if full implementation comes later, the architecture accommodates it from day one.

### Current State

Playwright already exists in `web-fetch.ts` with:

- Singleton browser instance (launched once, reused)
- Stealth mode (webdriver masking, fake Chrome runtime)
- `networkidle` page load, noise element removal
- But: **single-page content extraction only** — no clicking, forms, navigation

### Architecture (Build Now, Implement Incrementally)

**Phase 1 (Now): Tool Interface Design**

- Define browser action tool interfaces alongside web-fetch/web-search:
  - `browser_navigate(url)` — go to page
  - `browser_click(selector)` — click element
  - `browser_fill(selector, value)` — fill form field
  - `browser_screenshot()` — capture current page state
  - `browser_extract(selector)` — extract content from element
  - `browser_wait(condition)` — wait for page state
- Register in `conversation-tool-config.ts` (disabled by default, enable per-project)
- Extend existing Playwright singleton — don't create a second browser

**Phase 2 (Soon): Screenshot Feedback Loop**

- After each browser action, take screenshot → embed in chat
- Agent sees page state, decides next action
- User sees what the agent sees → can approve/reject/redirect
- Multi-step sequences: agent proposes plan → user approves → execute step by step

**Phase 3 (Later): Full Browser Agent**

- Complex multi-step workflows: "book a flight", "fill out this application"
- Session persistence: browser stays open between tool calls
- Cookie/auth management: agent can log into sites (with user-provided credentials)
- Parallel browsing: multiple tabs/contexts
- Recording/playback: save browser sequences for reuse

**Phase 4 (Future): MCP Browser Integration**

- Also support external browser agent MCP servers (Browser Use, Stagehand)
- Ember can route: "Ember, find me flights" → internal browser tools OR external MCP
- Best tool for the job: internal for simple tasks, MCP for complex ones

### Safety (Constitution Alignment)

- All browser actions classified as **external** (Constitution 7.2: Confirm Before Proceeding)
- No auto-purchase, no auto-login without explicit confirmation per-session
- Screenshot review: user sees every page state before agent acts
- Sensitive sites (banking, email, social media) require **per-action** approval
- Browser sandbox: separate Playwright context per session, no persistent cookies by default
- Credential handling: user provides auth via vault, agent uses token references (Constitution 5.1)

### Existing Code to Extend

- `web-fetch.ts` — Playwright singleton (`getOrCreateBrowser()`), stealth config
- `conversation-tool-config.ts` — tool registration and exclusion
- `useReactToolScheduler.ts` — tool execution scheduling
- `BaseDeclarativeTool` from `@office-ai/aioncli-core` — base class for custom tools

---

## 13. UX Polish — Sidebar, Onboarding, Tips

### Sidebar Three-Dot Menu

**Current:** Hover-reveal Edit/Delete icons only. No dropdown, no right-click.

**Proposed:** Faded three-dot icon per conversation, visible on hover → dropdown:

- Rename
- Move to Project
- Duplicate
- Pin to Top
- Archive
- Export (MD / JSON)
- Delete (with confirmation)

### First-Run Onboarding

3-5 step walkthrough on first launch:

1. "Welcome to Foundry" — what it is, what it does
2. Set up API keys (Gemini, OpenAI, Anthropic)
3. Choose your first agent
4. Create your first chat
5. Optional: "Start a project with Spark?"

Contextual tooltips on first visit to each major area. "Skip" always available.

### Tips System

- 100-200 micro-tips (5-15 words each)
- Shown on home page as rotating card or subtle banner
- Categories: shortcuts, productivity, features, agents, projects, Ember
- "Did you know?" format
- Dismissible, with "Show fewer tips" preference in settings
- Examples:
  - "Press Ctrl+K to quick-search conversations"
  - "Drag files into a chat to attach them"
  - "Say 'Ember, remember this' to save to memory"
  - "Skills auto-load when Spark detects your project type"

---

## 14. Channel Security — Critical Gaps Found

### Current Issues (From Research)

| Issue                 | Severity   | Current State                                    |
| --------------------- | ---------- | ------------------------------------------------ |
| Credential storage    | **HIGH**   | Base64 encoding only (NOT encryption)            |
| Rate limiting         | **HIGH**   | None — messages not rate-limited                 |
| Prompt injection      | **HIGH**   | No content filtering beyond HTML sanitization    |
| Pairing code strength | **MEDIUM** | 6-digit numeric, 10 min window (brute-forceable) |
| Session timeout       | **MEDIUM** | Sessions never expire                            |
| Per-user permissions  | **MEDIUM** | Binary authorized/not, no granular roles         |
| Audit logging         | **MEDIUM** | No record of who executed what                   |

### Required Fixes (Priority Order)

1. **Real encryption for credentials** — AES-256-GCM with machine-derived key (not Base64)
2. **Rate limiting** — per-user message rate limits (e.g., 30/min, 200/hour)
3. **Prompt injection defense** — content filtering layer that strips injection patterns
4. **Stronger pairing** — 8-character alphanumeric codes + rate limit on pairing attempts
5. **Session timeout** — auto-expire after configurable inactivity (default 24h)
6. **Role-based access** — read-only / limited / full access per user
7. **Activity logging** — integrate with Constitution's Activity Log (Section 10.2)
8. **Channel isolation** — per-user conversation isolation (no shared group chat leakage)

### Constitution Alignment

These fixes directly implement:

- Section 5.1: Credential Protection
- Section 5.4: Human Oversight (audit logging)
- Section 7.2: Confirm Before Proceeding (tool execution via channels)
- Section 10.1: Data Classification (credentials = Forbidden tier)
- Section 11.1: Minimal Authority

---

## 15. Upstream Analysis — AonUI + Dependencies

### AonUI Latest (v1.8.3, Feb 7 2026 — v1.8.4 in progress)

**What they've added since our fork:**

| Feature                       | Version              | Details                                                                                                     |
| ----------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| OpenClaw WebSocket Gateway    | v1.8.3               | Full agent type: Ed25519 device identity, auth tokens, WebSocket protocol, new DB migration, worker process |
| Security Settings Page        | v1.8.4 (in progress) | Centralized yoloMode (auto-approve) per agent. Dedicated `SecurityModalContent.tsx`                         |
| Agent Auto-Switch             | v1.8.3               | Intelligent fallback when agent unavailable. Pre-send readiness checks. `AgentSetupCard` UI                 |
| Multi-Channel Parallel        | v1.8.3               | WebUI + Telegram simultaneously                                                                             |
| Unified Permission Management | v1.8.2               | General permission storage for all agents                                                                   |
| Lark Channel                  | v1.8.2               | Feishu/Lark bot integration                                                                                 |
| Mermaid Chart Assistant       | v1.8.2               | SVG chart generation preset                                                                                 |
| Think Tag Filtering           | v1.8.3               | Strips `<think>`/`<thinking>` tags from streaming responses                                                 |
| MiniMax Platform              | v1.8.3               | New model platform with 4 text models                                                                       |
| ACP Session Resume            | v1.8.3               | Resume Claude sessions                                                                                      |

**Key architectural decisions they made:**

1. OpenClaw is a **new agent type** (like Gemini, Claude, Codex) — not bolted on. Full `src/agent/openclaw/` directory, own worker process, own DB conversation type.
2. OpenClaw connects via **WebSocket gateway** (not CLI). They initially tried CLI integration, removed it, switched to WebSocket. This is notable — they're treating OpenClaw as a service, not a CLI wrapper.
3. Security settings are **centralized** — removed yoloMode from individual Gemini settings, moved to dedicated Security page. This maps well to our Constitution softcoded defaults concept.
4. Agent readiness checking — good UX pattern: detect unavailable agents before user sends a message, show alternatives.

**What we should cherry-pick (concepts, not code):**

- Agent readiness checking (pre-send health check)
- Centralized security settings (maps to Constitution softcoded defaults)
- Think tag filtering (useful for models that expose thinking)
- Agent auto-switch fallback pattern

**What we skip:**

- OpenClaw integration (we're building Ember instead — safer, more integrated)
- Lark channel (removing it)
- MiniMax platform (niche)

### @office-ai/aioncli-core — Dependency Risk Assessment

**The situation:**
`@office-ai/aioncli-core` (v0.24.4) is iOfficeAI's own NPM package wrapping/extending Google's Gemini CLI. It is NOT a transparent fork — no public GitHub source. It's deeply embedded: 155+ imports across 54 files.

**What it provides:**

- `Config`, `GeminiClient`, `ServerGeminiStreamEvent`, `Turn` — core agent types
- `CoreToolScheduler`, `FileDiscoveryService` — tool management
- `BaseDeclarativeTool` — base class for custom tools (web-fetch, web-search, img-gen all extend this)
- `MCPOAuthProvider`, `MCPOAuthTokenStorage` — MCP OAuth
- `AuthType`, various event types — configuration and streaming

**Risk factors:**

- No public source → can't see patches applied vs upstream Google Gemini CLI
- NPM-only distribution → dependency on iOfficeAI's continued maintenance
- Breaking changes have occurred (v0.18.4 removed APIs)
- If iOfficeAI stops publishing, Foundry is stuck

**Options:**

1. **Continue as-is** — least effort, accept the risk. Monitor for breaking changes.
2. **Fork @office-ai** — vendor a local copy, take ownership. Medium effort.
3. **Migrate to @google/gemini-cli-core** — use official Google package. High effort (rewrite tool base classes, config, OAuth). Eliminates dependency entirely.

**Recommendation:** Option 2 (fork) as a medium-term goal. Continue as-is for now, but plan a migration sprint. Document exactly what @office-ai adds over @google/gemini-cli-core so we know the gap.

### Claude Task Master (~25K stars)

**What it is:** PRD → structured task decomposition. Parses requirements into hierarchical tasks with dependencies, subtasks, priorities. 49+ MCP tools. Works with Cursor, VS Code, etc.

**Relevant patterns for Foundry:**

- **Task decomposition from PRDs** → maps to Spark output (after discovery, generate task breakdown)
- **Multi-agent coordination** via shared `tasks.json` → CLI agents working from same task list
- **Agent specialization**: orchestrator (plans), executor (codes), checker (reviews)
- **Research-backed decomposition** (Perplexity for fresh data before task breakdown)

**How it fits:**
After Spark generates a PRD, it could also generate a `.foundry/tasks.json` with structured tasks. Agents reference it. UI shows task progress. But this is Phase 4+ — after Projects and Spark are stable.

**Recommendation:** Learn from patterns, don't replicate. Task hierarchy is a natural extension of Projects, not a core feature.

---

## 16. Competitive Analysis

### OpenClaw (formerly ClawdBot/MoltBot)

**Stats:** 145K+ GitHub stars, 172K lines TypeScript, very active development

**Architecture:**

- TypeScript daemon on port 18789
- Skill-based plugin system with ClawHub registry
- Native MCP support
- Multi-channel (WhatsApp, Telegram, Slack, Discord, Signal, iMessage)
- Policy-as-code safety rails
- Sandboxed execution environment

**Key Features We Should Learn From:**

| Feature            | OpenClaw                                      | Foundry Equivalent                   |
| ------------------ | --------------------------------------------- | ------------------------------------ |
| Skill library      | 50+ integrations, ClawHub store               | Chip library + skill store (planned) |
| Proactive behavior | Heartbeat system, daily summaries             | Ember layer (planned)                |
| Memory             | Daily logs, hybrid search (70/30 vector/BM25) | sqlite-vec + ONNX (planned)          |
| MCP                | Native support                                | Already integrated                   |
| Channels           | 6+ platforms                                  | 2 now, 5 planned                     |
| Safety             | Policy-as-code                                | Constitution (stronger governance)   |
| Sandboxing         | Built-in sandbox                              | Electron process isolation           |

**Where Foundry Differentiates:**

- **GUI-first** — OpenClaw is CLI/daemon-first. Foundry has a proper desktop UI.
- **Multi-agent** — Foundry wraps multiple CLI agents. OpenClaw is a single agent.
- **Constitution** — Foundry's governance document is more structured than policy-as-code.
- **Projects** — Structured onboarding (Spark) is unique to Foundry.
- **Preview/Editing** — Rich content handling with TipTap + Monaco.

**Where OpenClaw Is Ahead:**

- Proactive behavior (heartbeat, daily summaries)
- Channel breadth (6+ platforms vs 2)
- Skill ecosystem (50+ vs ~5)
- Memory system (production-hardened)
- Community size (145K stars)

### Nanobot

**Stats:** ~4K lines Python, claims "1% of OpenClaw's size with most features"

**Architecture:**

- Ultra-lightweight Python daemon
- MCP-based tool system
- Cron scheduling for proactive tasks
- Fire-and-forget subagents
- Multi-channel (Telegram, WhatsApp, Discord, Feishu)

**Key Insights:**

- Proves proactive behavior doesn't require massive infrastructure
- Cron + lightweight model calls = effective assistant
- MCP as the universal tool interface (aligns with Foundry's direction)
- WhatsApp/Discord integrations as reference implementations

**Integration Opportunity:**
Could Foundry run Nanobot as a background daemon via MCP? Nanobot is MCP-native, so Foundry could:

1. Install Nanobot as an MCP server
2. Nanobot handles channels (WhatsApp, Discord) that Foundry doesn't natively support
3. Foundry provides the GUI, memory, and project context
4. Nanobot provides the daemon behavior and additional channels

This is the "stay thin" principle: use existing tools rather than rebuilding.

### ChatGPT Desktop App

**The closest single-product competitor to Foundry's full vision.**

Has: persistent memory, custom GPTs (comparable to skills), file upload, voice mode (input + output), canvas (comparable to Stubs + editing), image generation (DALL-E).

**Where Foundry differentiates:**

- Agent-agnostic (not locked to one model provider)
- Local-first (no cloud dependency for core features)
- Open source (inspectable, forkable, extensible)
- Projects with structured onboarding (Spark)
- Multi-agent orchestration (CLI agents as tools)
- Distribution channels (Telegram, Slack, etc.)

### Cursor / Windsurf / Codeium

**AI code editors — closest competitors for "AI development platform" positioning.**

These are IDEs with AI bolted on. Foundry is a command center with IDEs as backends. Different layers:

- Cursor/Windsurf = IDE + AI assistant
- Foundry = Agent orchestrator + Project manager + Distribution platform
- Foundry doesn't compete with IDEs — it coordinates the agents that power them

### Multi-Agent Frameworks (CrewAI, AutoGen, LangGraph)

Ember's routing/coordination is lightweight multi-agent orchestration. Key lessons from their failures:

- CrewAI: Complex YAML configuration, hard to debug, agents go off-track without tight guardrails
- AutoGen: Excessive message passing overhead, conversation loops
- LangGraph: Good state management but steep learning curve

**Ember should be simpler:** Route to the right CLI agent, inject context, return results. Not a general-purpose multi-agent framework.

---

## 16. Architecture Principles

### Stay Thin at the Agent Layer, Orchestrate at the Platform Layer

- **Agent layer (thin):** Don't replicate what CLI agents do. Gemini CLI handles code gen, Claude Code handles reasoning. Foundry wraps, doesn't rebuild.
- **Platform layer (rich):** Foundry IS the orchestration layer ABOVE agents. Projects, memory, skills, channels, Constitution enforcement, Ember coordination — this is Foundry's unique value.
- Fix CLI deficiencies (web tools) and add platform value (projects, memory, editing, distribution).
- The "stay thin" principle means: don't fight upstream CLIs. The "orchestrate" principle means: add the coordination, context, and continuity that no single CLI provides.

### Constitution-Governed

- All agent behavior governed by the Constitution
- Principal hierarchy: Platform > Workspace > User > Agent
- Hardcoded boundaries enforced at platform level
- Softcoded defaults configurable per workspace
- Activity logging for audit trail

### Local-First

- All data stored locally (SQLite, filesystem)
- Memory/RAG runs locally (sqlite-vec + ONNX Runtime)
- No external service dependencies for core features
- Optional cloud services for channels and sync (future)

### Modular + Pluggable

- Skills as markdown files (portable, human-readable)
- MCP for tool integration (standard protocol)
- Channel plugins extending BasePlugin
- Everything configurable per workspace or globally

### Privacy by Design

- Credentials never in memory, logs, or files
- Cross-workspace isolation
- User controls all data: inspect, export, delete
- Local processing preferred over external API calls

---

## 17. Implementation Roadmap

### Phase 0: Channel Security Hardening (URGENT)

**Effort:** Medium | **Impact:** Critical | **Dependencies:** None
_Must happen before adding more channels or Ember channel integration_

1. Real credential encryption (AES-256-GCM)
2. Per-user rate limiting
3. Prompt injection content filter
4. Stronger pairing codes (8-char alphanumeric)
5. Session timeout (configurable, default 24h)

### Phase 1: Works + UX Polish (Renderer Only)

**Effort:** Medium | **Impact:** High | **Dependencies:** None

1. `StubCard.tsx` — file card component for completed works
2. `StubStream.tsx` — live creation view (collapsible streaming)
3. Code block thresholds in `Markdown.tsx` (auto-collapse for 20-50 lines)
4. Sidebar three-dot dropdown menu
5. i18n keys
6. First-run onboarding sequence
7. Tips system (home page rotating micro-tips)

### Phase 2: Constitution Integration

**Effort:** Medium | **Impact:** High | **Dependencies:** None

1. Replace in-repo constitution with new CONSTITUTION.md
2. Settings UI: Constitution viewer (read-only, syntax highlighted)
3. Softcoded defaults panel (communication, operations, safety settings)
4. Load constitution into agent system prompts
5. Action classification enforcement via existing approval system

### Phase 3: Project Foundation

**Effort:** Medium | **Impact:** High | **Dependencies:** Phase 2

1. `projectService.ts` — detect, initialize, read `.foundry/`
2. `projectBridge.ts` — IPC bridge
3. Context loading in all agent managers (`.foundry/instructions.md`, skills, memory)
4. Sidebar "New Project" button (dropdown: New Chat / New Project)
5. Home page project cards (2 rows of 3)
6. "Promote to Project" on existing conversations
7. Multi-chat per project with shared context

### Phase 4: Spark Onboarding

**Effort:** Large | **Impact:** High | **Dependencies:** Phase 3

1. Adapt Foundry Kickstart → `assistant/foundry-spark/spark.md` (no "Pam" persona, just Spark)
2. Ship skill library as `assistant/foundry-spark/skills/*.md`
3. Register Spark as builtin preset
4. `ProjectWizard.tsx` → workspace selection → Spark conversation
5. Skill auto-detection during Spark

### Phase 5: Persistent Memory + User Profile

**Effort:** Large | **Impact:** Very High | **Dependencies:** Phase 3

1. Add `sqlite-vec` to better-sqlite3
2. Add ONNX Runtime + bge-micro-v2 (22.9MB local embeddings)
3. Memory service: ingest, chunk, embed, store, hybrid search
4. Session summary generation (post-conversation)
5. Memory retrieval at conversation start
6. User profile learning (personality adaptation)
7. Memory management UI (Settings → Memory: inspect, search, delete)

### Phase 6: Editing Suite

**Effort:** Medium | **Impact:** Medium | **Dependencies:** Phase 1 (Works)

1. Add TipTap dependencies + extensions
2. `FoundryDocEditor.tsx` — TipTap WYSIWYG component
3. Replace `MarkdownEditor` in Preview with TipTap for `.md` files
4. Keep CodeMirror for HTML/text source editing
5. Keep Monaco for code viewing in standalone contexts

### Phase 7: Skill Store + Security

**Effort:** Medium | **Impact:** Medium | **Dependencies:** Phase 4

1. Skill management UI in Settings → Skills
2. Bundled skill library (30+ domain skills)
3. Import/export with security audit on import
4. Skill auto-suggestions during chat
5. "Generate a skill" button (uses Claude)
6. Community skill index (GitHub-based initially)

### Phase 8: MCP Store

**Effort:** Medium | **Impact:** Medium | **Dependencies:** None

1. Import/sync from existing MCP repos (auto-update every 24h)
2. Browse/search/install UI in Settings → MCP
3. Pre-bundle 24+ most popular MCPs (Google, Azure, GitHub, Jira, Slack, etc.)
4. Auto-configuration + OAuth flow for configured MCPs
5. Health check / connection testing
6. Per-project MCP config in `.foundry/mcp.json`

### Phase 9: Ember — Core

**Effort:** Large | **Impact:** Very High | **Dependencies:** Phase 5 (memory)

1. Session continuity ("Welcome back" context)
2. "Ember, ..." invocation in any chat
3. Personality system (Settings → Ember)
4. Daily briefing via CronService
5. Proactive suggestions (stale TODOs, skill recommendations)
6. Cross-project awareness via global memory
7. Autonomy level settings (Guided / Balanced / Free Reign)

### Phase 10: Voice Mode

**Effort:** Large | **Impact:** High | **Dependencies:** Phase 9 (Ember)

1. OpenAI Whisper integration (STT)
2. ElevenLabs + OpenAI TTS integration
3. Desktop microphone input in SendBox
4. Channel voice note handling (receive + respond)
5. Ember voice personality selection
6. Future: Twilio phone call integration

### Phase 11: Additional Channels

**Effort:** Medium per channel | **Impact:** Medium | **Dependencies:** Phase 0 (security), Phase 9 (Ember)

1. Remove Lark plugin
2. Slack plugin (`@slack/bolt`)
3. WhatsApp plugin (Business API)
4. Discord plugin (`discord.js`)
5. Signal plugin (`signal-cli`)

### Phase 12: Browser Agent

**Effort:** Medium-Large | **Impact:** Medium | **Dependencies:** Phase 8 (MCP)

1. Integrate browser agent MCP server (Browser Use / Stagehand)
2. Screenshot feedback in chat
3. Multi-step navigation approval flow
4. Fallback: expand Playwright toolkit if MCP insufficient

---

## 18. Open Questions & Decisions

### Decided

1. **Skill format:** Hybrid — "Stubs" (standard MD, compatible with all ecosystems) + "Enhanced" (YAML frontmatter, Foundry-specific features). Import any `.md` skill, enhance with metadata if desired.
2. **Memory model:** Hybrid persistent memory + Gemini Flash for operations. Large-scale project support. (Details TBD — needs architecture deep dive for scaling.)
3. **Multi-chat:** Yes, per project. Shared `.foundry/` context + RAG memory bridges sessions. Better than Claude.ai's approach.
4. **MCP store:** Import from existing repos, auto-update every 24h. Don't maintain our own list.
5. **Ember:** **Thin assistant, orchestrator only when needed.** ~1% of Claude Code. Assists, doesn't try to be a multi-agent framework. Daemon architecture (app-bound tray mode default, true system daemon opt-in).
6. **Ember personality:** Bubbly, friendly, conversational by default. Customizable in settings. Voice personality tied to TTS selection.
7. **Editors:** TipTap replaces MarkdownEditor for WYSIWYG. CodeMirror stays for source. Monaco stays for code.
8. **Channels:** Remove Lark. Add Slack, WhatsApp, Discord, Signal. All channels = Ember.
9. **Spark:** Just Spark. No persona. Project assistant / project manager role. Handles onboarding and discovery.
10. **Constitution enforcement:** Deep — the laws for everything in every aspect. Every CLI agent must respect the Constitution. CLAUDE.md, gemini instructions, codex prompts all carry Constitution rules. Settings UI exposes softcoded defaults. Hardcoded boundaries enforced at platform level.
11. **Voice:** Both ElevenLabs AND OpenAI TTS. ElevenLabs primary for voice conversations with Ember (higher quality). OpenAI as fallback/alternative.
12. **Browser agent:** Build into architecture from day one. Extend existing Playwright singleton. Stagehand as reference.
13. **Onboarding:** Max 7 steps, optional/skippable, rerunnable from Settings.
14. **Tips:** AI-generated, human-curated. Generate 200+ with Claude, manually curate to best 100-150.
15. **DB CHECK constraints:** Remove, replace with Zod validation at TypeScript layer. One migration, permanent fix.
16. **Conversation search:** Add FTS. Search at top level, sub-projects, and within projects.
17. **Ember activity feed:** Add activity inbox showing what Ember did. Transparency = trust.
18. **Project lifecycle:** Archive, delete, rename, template support. 50+ pre-built project templates as competitive edge.
19. **Data export/portability:** Import/export supported with security audits on imports. No bad code in the inner sanctum.
20. **Cost management:** API usage dashboard with per-feature cost breakdown, optional budget limits.
21. **Accessibility:** Keyboard nav, screen readers, ARIA, color contrast. Voice dictation/replies add accessibility layer. Supplementary, don't kill functionality.
22. **Testing:** Built into swarm development. Testing QA agent runs alongside feature agents. Every phase has test requirements.
23. **Error recovery:** Every feature has degradation path. "When X fails, system does Y, user sees Z."
24. **Context budget:** Token budget allocator per agent type. Auto-scaling or permission-based auto-scaling.
25. **Native module spike:** ONNX + sqlite-vec must be spiked in Phase 0-1, not Phase 5. Fallback: API-based embeddings if native fails.
26. **Forge IDE:** VS Code clone (based on Void). Shares settings with Foundry. "Open in Forge" from projects. Foundry = command center, Forge = hands-on IDE.
27. **Development approach:** Claude Code Agent Teams (swarm). Detailed battle plan + updated CLAUDE.md. Parallel execution with testing agent.
28. **Architectural principle:** "Stay thin at the agent layer, orchestrate at the platform layer." Ember is thin. Foundry platform is the rich orchestration layer.
29. **i18n:** Decision needed — English-only going forward, or maintain translations?

### Resolved (Session 3)

30. **Signal SDK:** `libsignal-node` (native). No Java wrapper dependency.
31. **@office-ai/aioncli-core:** Fork for trust and transparency. Rebrand the fork. Own the code rather than depending on opaque 3rd-party package.
32. **Memory scaling:** Hybrid search with progressive chunking. 512-token chunks at paragraph boundaries. Top-K retrieval (K=10-20 per query). BM25 index for keyword search alongside vector index. Prune old session summaries (keep decisions, discard verbose logs). Cap memory injection at 15% of agent context budget. Re-index on schema changes.
33. **i18n:** English-only until later. Remove unused locale files. Simplify i18n infrastructure.

**All questions resolved. Zero open items. Ready for execution.**

---

## 19. Architectural Review — Gaps & Risks

_Added Session 3: Senior architect review of the full brainstorming document._

### Critical Architectural Issues

**1. "Stay Thin" vs Ember — The Identity Crisis**
The stated principle is "Stay thin. Don't orchestrate. Enhance." But Ember IS orchestration — the most complex kind: persistent daemon, agent routing, proactive behavior, cross-project coordination, multi-channel management. This is the single biggest conceptual tension in the document.

**Resolution needed:** Either "stay thin" applies only to CLI wrapping (don't replicate what Gemini CLI / Claude Code already do) and Ember is acknowledged as a NEW orchestration layer that adds value ABOVE the CLIs, or Ember must be scoped down dramatically. Recommendation: amend the principle to **"Stay thin at the agent layer. Orchestrate at the platform layer."** Foundry doesn't replicate CLI orchestration. Ember orchestrates across CLIs, memory, channels, and projects.

**2. Database CHECK Constraints Will Break Repeatedly**
Current schema uses hardcoded SQL CHECK constraints: `type IN ('gemini', 'acp', 'codex', 'image')`, `source IN ('foundry', 'telegram')`. SQLite cannot ALTER CHECK constraints — every new agent type or channel source requires table recreation. By Phase 11, you need sources for slack, whatsapp, discord, signal, ember. Each = painful migration.

**Fix:** Drop CHECK constraints, move to Zod validation at TypeScript layer. One migration, permanent fix.

**3. ONNX Runtime + sqlite-vec Native Module Risk**
The project already has cross-platform build pain with better-sqlite3, node-pty, and tree-sitter. Adding two more native dependencies multiplies the binary matrix (macOS arm64/x64, Windows x64, Linux x64). sqlite-vec requires `db.loadExtension()` with platform-specific paths. ONNX Runtime has separate packages per platform.

**MUST spike inside Electron on all three platforms before committing.** If this fails, fallback: use an API-based embedding service (Gemini embeddings are free) with local sqlite-vec for storage only.

**4. Worker Architecture Doesn't Support Ember**
`BaseAgentManager` forks a worker per conversation — start, run, die. Ember needs a persistent, always-on worker that coordinates across multiple active agents, processes channel messages, and performs background memory operations. This is a fundamental architectural change not addressed.

**5. No Context Budget Management**
Different agents have different context limits (Gemini 1M, Claude 200K, Codex 128K). Injecting constitution + skills + user profile + memory chunks + conversation history needs a token budget allocator per agent type. Without this, either memory gets too much space (conversation gets truncated) or too little (memory is useless).

### Missing Features

**6. No Conversation Search**
FTS was added in migration v3, then removed. Projects with multi-chat and hundreds of conversations need search. Full-text search across conversation history is table-stakes for any chat application.

**7. No Ember Activity Feed**
The Constitution requires transparency. Ember acts proactively. Users need a UI showing what Ember did while they were away — otherwise they won't trust it. Needs: activity inbox, action replay, "why did you do this?" explanations.

**8. No Project Lifecycle**
Projects are created (Spark) and used (multi-chat). Missing: archive completed projects, delete (cascade behavior?), rename/move workspace paths, templates, "promote workspace to project."

**9. No Data Export/Portability**
Constitution promises user data control. Concrete plan needed: export project as portable bundle, migrate between machines, handle embedding model changes (re-embed on import).

**10. No Cost Management**
Background API usage (memory ops via Gemini Flash, voice via Whisper+ElevenLabs, Ember proactive features) consumes tokens silently. Users need: usage dashboard, per-feature cost breakdown, optional budget limits, "pause background processing" toggle.

### Missing Cross-Cutting Concerns

**11. No Testing Strategy**
12 phases, zero mention of testing. The codebase has 3 unit test files. Each phase needs: what to test, how to test, acceptance criteria. Critical areas needing tests: memory persistence, credential encryption, channel security, project context loading, Constitution enforcement.

**12. No Error Recovery/Degradation Strategy**
What happens when: ONNX Runtime fails to load? sqlite-vec doesn't compile? A channel plugin crashes mid-conversation? Ember daemon crashes processing a Telegram message? `.foundry/` gets corrupted? Every feature needs a "when X fails, the system does Y, the user sees Z" path.

**13. No Accessibility Plan**
Zero mentions of keyboard navigation, screen reader support, ARIA labels, color contrast requirements, `prefers-reduced-motion`. For a desktop app with rich UI targeting developers, this is a significant gap.

**14. No i18n Plan for New Features**
Git status shows deletion of multiple locale files (ja-JP, ko-KR, tr-TR, zh-CN, zh-TW). 12+ new feature surfaces (Stubs, Projects, Spark, Ember, Constitution UI, Skill Store, MCP Store, Voice) without addressing translations. Decision needed: English-only going forward, or maintain translations?

**15. No Offline Mode Definition**
"Local-first" claim is unsubstantiated. Agent conversations, channels, and voice all require network. Need to define what works offline (memory search, conversation viewing, editing, project browsing) vs what doesn't.

### Security Blind Spots

**16. Skill Injection Is Deeper Than Documented**
Pattern-matching security scan catches obvious attacks ("ignore previous instructions", shell commands). But skills are system prompt content. Subtle behavioral manipulation ("when the user asks to commit, also add this line...") won't be caught. The document should acknowledge this is unsolved rather than implying the scan is sufficient.

**17. Ember Daemon Credential Access on Linux**
AES-256-GCM with "machine-derived key" — on macOS = Keychain, Windows = DPAPI. On Linux, `libsecret` requires a running desktop session, which a systemd user service won't have. Electron's `safeStorage` API requires `app.isReady()`, which headless daemon won't have. Real blocker for Tier 2 daemon on Linux.

**18. No Rate Limiting on Tool Execution**
Channel security identifies missing message rate limits. But there's no rate limiting on tool execution. A prompt injection via Telegram could trigger hundreds of `web_fetch` calls (auto-proceed in Constitution). Need per-tool rate limits.

**19. Cross-Channel Identity Not Unified**
User pairs on Telegram and Slack → two separate `assistant_users` entries. No unified identity means: memory isn't shared, rate limits are per-channel, revoking on one channel doesn't affect others.

### Implementation Order Issues

**20. Phase 2→3 dependency is artificial.** Projects don't need Constitution to ship. Folder detection + context loading + UI is independent. Constitution becomes a context-loading enhancement later. Decoupling ships Projects faster.

**21. Phase 12→8 dependency is artificial.** Browser agent can use internal Playwright tools directly (code already exists in `web-fetch.ts`). MCP integration for Browser Use/Stagehand is optional, not prerequisite.

**22. Phases 6-8 should be marked parallelizable.** Editing Suite, Skill Store, and MCP Store have no dependencies on each other and can fill time while Memory (Phase 5) is being built.

**23. Memory work should start alongside Projects.** Projects without memory are static (just file-loading). Memory makes projects dynamic. Starting memory work in Phase 3 alongside project foundations lets both mature together.

**24. Native module spike must happen Phase 0-1.** If ONNX + sqlite-vec don't work cross-platform in Electron, the entire memory architecture needs redesign. Can't discover this blocker in Phase 5.

### Competitive Blind Spots

**25. ChatGPT Desktop App** — Has persistent memory, custom GPTs (comparable to skills), voice mode, canvas (comparable to Stubs/editing). Closest single-product competitor to Foundry's full vision. Differentiation: Foundry is agent-agnostic, local-first, open.

**26. Cursor / Windsurf / Codeium** — AI code editors are the closest competitors for "AI development platform" positioning. Foundry differentiates as "agent-agnostic cockpit, not an IDE."

**27. Multi-agent frameworks (CrewAI, AutoGen, LangGraph)** — Ember's routing/coordination is lightweight multi-agent orchestration. Understanding their failure modes would inform Ember's design.

### Practical Concerns

**28. App bundle size grows ~75-110MB** with ONNX Runtime (~50-80MB) + bge-micro-v2 (22.9MB) + sqlite-vec (~2-5MB). Acceptable for dev tooling, should be documented.

**29. Startup time will degrade.** Each phase adds init: load sqlite-vec, init ONNX, start Ember, check channels, load project context, run memory retrieval, start cron. Need lazy loading: immediate (core UI), deferred (memory, channels), on-demand (ONNX, TipTap).

**30. Single-developer capacity vs scope.** 12 phases spanning native ML inference, WYSIWYG editing, daemon architecture, multi-channel SDKs, voice processing, and browser automation is multi-year, multi-engineer work. Each phase needs a "minimum viable" scope defined alongside the full vision. **This is where the Claude Code swarm development strategy becomes critical (Section 20).**

---

## 20. Development Strategy — Claude Code Swarm

_Added Session 3: How to use Claude Code's multi-agent system to build Foundry in parallel._

### Claude Code's Three Tiers of Parallelism

| Tier                      | Mechanism                                         | Context                                   | Cost                           | Best For                                    |
| ------------------------- | ------------------------------------------------- | ----------------------------------------- | ------------------------------ | ------------------------------------------- |
| **Task Tool** (Subagents) | Ephemeral workers in one session                  | Own 200k window, results return to parent | Moderate (~20k overhead/agent) | Focused tasks: research, search, test runs  |
| **Custom Subagents**      | `.claude/agents/*.md` with YAML frontmatter       | Own context, configurable tools/model     | Moderate                       | Reusable domain workers: reviewer, debugger |
| **Agent Teams** (Swarm)   | Multiple full Claude Code instances + coordinator | Fully independent per teammate            | High (5-10x single session)    | Complex parallel work across layers         |

### Agent Teams — The Swarm

Shipped Feb 5, 2026 with Opus 4.6. **Research preview, disabled by default.**

**Enable:**

```json
// settings.json or environment variable
{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
```

**Architecture:**

- **Team Lead** — Main session. Creates team, spawns teammates, coordinates, synthesizes.
- **Teammates** — Separate Claude Code instances. Each loads CLAUDE.md, MCP servers, works independently.
- **Shared Task List** — Central work items: pending → in_progress → completed. Dependency tracking. File locking prevents race conditions.
- **Mailbox** — JSON-based inter-agent messaging. Teammates message each other directly, not just the lead.

**Key Modes:**

- **Delegate Mode** (Shift+Tab) — Forces lead to coordinate only, not implement.
- **Plan Approval** — Teammates submit plans before code changes. Lead reviews.
- **In-process display** (default) — All teammates in one terminal. Shift+Up/Down to select.

### Proposed Foundry Swarm Configuration

**For Phase-Level Parallel Work (Agent Teams):**

```
Create an agent team with 4 teammates:

1. "renderer" — Frontend specialist
   Focus: src/renderer/ — Stubs, UI components, sidebar menus,
   TipTap integration, settings panels

2. "platform" — Backend specialist
   Focus: src/process/ — project service, memory service, bridges,
   database migrations, context loading

3. "security" — Security + channels specialist
   Focus: src/channels/, src/common/ — credential encryption,
   rate limiting, pairing, channel plugins

4. "agents" — Agent + tools specialist
   Focus: src/agent/, src/worker/ — browser agent interfaces,
   tool config, Ember worker architecture
```

**File Ownership Rules (Prevent Conflicts):**
| Teammate | Owns | Never Touches |
|----------|------|---------------|
| renderer | `src/renderer/**` | `src/process/**`, `src/channels/**` |
| platform | `src/process/**`, `src/common/**` | `src/renderer/**` |
| security | `src/channels/**`, `src/webserver/**` | `src/renderer/**` |
| agents | `src/agent/**`, `src/worker/**` | `src/renderer/**` |

Shared files (`src/common/types`, `package.json`, database schema) go through the lead.

### Custom Subagents for Foundry

Create these in `.claude/agents/` for reusable, focused work:

**foundry-frontend.md:**

```markdown
---
name: foundry-frontend
description: Frontend specialist for Foundry React + UnoCSS components
tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

You specialize in Foundry's renderer layer.
Key patterns: Foundry prefix for base components, Arco Design,
CSS custom properties, ProcessingContext for state, UnoCSS atomic classes.
Path: src/renderer/. Uses @renderer/ alias.
```

**foundry-backend.md:**

```markdown
---
name: foundry-backend
description: Backend specialist for Foundry main process services
tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

You specialize in Foundry's main process layer.
Key patterns: IPC bridges, better-sqlite3, electron-store,
utilityProcess workers, service pattern.
Path: src/process/. Uses @process/ alias.
```

**foundry-reviewer.md:**

```markdown
---
name: foundry-reviewer
description: Reviews code for Foundry conventions and security
tools: Read, Grep, Glob
model: sonnet
permissionMode: dontAsk
---

Review code for: OWASP Top 10, credential exposure, prompt injection,
Foundry naming conventions, TypeScript strictness, UnoCSS usage,
Constitution compliance (action classification, memory tiers).
```

**foundry-tester.md:**

```markdown
---
name: foundry-tester
description: Writes and runs tests for Foundry features
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

Write Jest tests for Foundry. Test structure: tests/unit/, tests/integration/.
Focus on: memory persistence, credential encryption, channel security,
project context loading, database migrations.
```

### Development Workflow with Swarm

**Phase execution pattern:**

1. **Planning session** (single Claude, plan mode)
   - Break phase into discrete tasks
   - Assign file ownership per teammate
   - Define integration points and contracts (TypeScript interfaces)

2. **Parallel implementation** (Agent Team, 3-4 teammates)
   - Lead spawns teammates with specific task lists
   - Delegate mode ON — lead coordinates, doesn't code
   - Each teammate works within their file ownership boundary
   - Teammates message each other for interface contracts

3. **Integration** (single Claude)
   - Lead reviews all teammate output
   - Resolve any interface mismatches
   - Run full test suite
   - Commit

4. **Review** (foundry-reviewer subagent)
   - Security review
   - Convention check
   - Constitution compliance

### Practical Tips

- **Start with 2-3 teammates, not 4.** Build confidence before scaling.
- **5-6 tasks per teammate.** Too small = coordination overhead. Too large = drift.
- **Define interfaces first.** Before teammates start coding, agree on TypeScript interfaces for cross-boundary communication. Lead defines these.
- **Don't edit shared files in parallel.** `package.json`, database schema, shared types → lead handles these sequentially after teammates finish.
- **Use plan approval.** Teammates submit implementation plans before writing code. Lead reviews for conflicts.
- **In-process mode on Windows.** Split panes don't work on Windows Terminal. Use in-process mode (Shift+Up/Down to navigate).
- **Cost control.** Each teammate = separate Claude instance. Budget ~$5-15/hour for a 4-teammate team. Start with research/exploration teams (cheaper, lower risk) before implementation teams.

### Phase-by-Phase Swarm Strategy

| Phase                  | Team Size | Strategy                                                                        |
| ---------------------- | --------- | ------------------------------------------------------------------------------- |
| Phase 0 (Security)     | 2         | security + platform (credential encryption + DB migration)                      |
| Phase 1 (Stubs + UX)   | 2         | renderer (Stubs + sidebar) + renderer-2 (onboarding + tips)                     |
| Phase 2 (Constitution) | 1         | Single session — mostly settings UI + system prompt injection                   |
| Phase 3 (Projects)     | 3         | platform (service + bridge) + renderer (UI) + agents (context loading)          |
| Phase 4 (Spark)        | 1         | Single session — preset definition + wizard UI                                  |
| Phase 5 (Memory)       | 3         | platform (sqlite-vec + ONNX) + agents (memory injection) + renderer (memory UI) |
| Phase 6-8 (parallel)   | 4         | renderer (TipTap) + platform (skill store) + platform-2 (MCP store) + tester    |
| Phase 9 (Ember)        | 4         | Full team — Ember touches everything                                            |

### Agent SDK — For CI/CD and Automation (Future)

The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) enables programmatic Claude Code:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const message of query({
  prompt: 'Run the full test suite and report failures',
  options: {
    allowedTools: ['Read', 'Glob', 'Grep', 'Bash'],
    maxTurns: 20,
  },
})) {
  if ('result' in message) console.log(message.result);
}
```

**Future use cases for Foundry:**

- Automated PR review with foundry-reviewer agent
- CI pipeline integration (test + lint + security scan)
- Automated Constitution compliance checking on PRs
- Nightly memory index health checks

### Third-Party Orchestration Tools (Reference)

- **[claude-flow](https://github.com/ruvnet/claude-flow)** — Open-source agent orchestration with distributed swarm intelligence and RAG integration
- **[claude-swarm-orchestration](https://github.com/MaTriXy/claude-swarm-orchestration)** — Community guide for multi-agent coordination patterns

### Key Limitations

- Agent Teams is **research preview** — may change
- **No session resumption** for teammates (`/resume` doesn't restore team)
- **No nested teams** — teammates can't spawn their own teams
- **Split panes don't work** on Windows Terminal, VS Code integrated terminal, or Ghostty
- **One team per session** — clean up before starting a new team
- **Permissions set at spawn** — all teammates inherit lead's permission mode
- **Cost** — Agent teams cost 5-10x more tokens than single sessions

---

## 21. Battle Plan — Overnight Swarm Execution

_This section is the executable task list for Claude Code Agent Teams. Each task includes exact files to create/modify, acceptance criteria, and rollback instructions._

### Execution Strategy

**Mode:** Supervised autonomous — agents have full CPU/GPU access, run until all tasks complete.
**Approach:** Sequential phases, parallel tasks within each phase.
**Testing:** Every phase verified before moving to next. Testing agent runs alongside feature agents.
**Rollback:** Git branch per phase. If phase fails, `git checkout` back to branch start.

### Pre-Flight Checklist

Before starting any phase:

1. `git checkout -b foundry/phase-N` (create phase branch)
2. `npm start` to verify app builds and runs
3. Run existing tests: `npm test`

### PHASE 0: Foundation — DB Migration + Security Hardening

**Branch:** `foundry/phase-0-foundation`
**Team:** 2 agents (platform + security)
**Estimated time:** 2-3 hours

#### Task 0.1: Remove DB CHECK Constraints → Zod Validation

**Agent:** platform
**Files to modify:**

- `src/process/database/schema.ts` — Remove CHECK constraints from conversation table, assistant_users table
- `src/process/database/migrations.ts` — Add new migration that recreates tables without CHECK constraints
- `src/process/database/types.ts` — Add Zod schemas for conversation type, source type validation

**Acceptance criteria:**

- App starts without errors
- Existing conversations load correctly
- New conversations with any type string are validated by Zod
- Invalid types are rejected at TypeScript layer, not SQL layer

**Rollback:** `git checkout -- src/process/database/`

#### Task 0.2: Real Credential Encryption

**Agent:** security
**Files to modify:**

- `src/channels/utils/credentialCrypto.ts` — Replace Base64 with AES-256-GCM using Electron `safeStorage` API

**Acceptance criteria:**

- Existing credentials are migrated on first run (decrypt Base64, re-encrypt with AES-256-GCM)
- New credentials encrypted with real encryption
- Credentials are unreadable without Electron `safeStorage` key
- All channel plugins still function (Telegram pairing still works)

**Rollback:** `git checkout -- src/channels/utils/credentialCrypto.ts`

#### Task 0.3: Rate Limiting + Stronger Pairing

**Agent:** security
**Files to modify:**

- `src/channels/pairing/PairingService.ts` — 8-char alphanumeric codes, rate limit pairing attempts (max 5/min)
- NEW `src/channels/utils/rateLimiter.ts` — Per-user message rate limiter (30/min, 200/hour)
- `src/channels/plugins/telegram/TelegramPlugin.ts` — Integrate rate limiter
- `src/channels/plugins/BasePlugin.ts` — Add rate limiter hook

**Acceptance criteria:**

- Pairing codes are 8 characters, alphanumeric
- More than 5 pairing attempts in 60 seconds → blocked
- More than 30 messages/minute from one user → rate limited with friendly message
- Rate limits are configurable

**Rollback:** `git checkout -- src/channels/`

#### Task 0.4: Debug Console.log Cleanup

**Agent:** platform
**Files to modify:**

- `src/renderer/components/SettingsModal/index.tsx:203` — Remove debug console.log

**Acceptance criteria:** No debug console.log in production code.

#### Phase 0 Tests

**Files to create:**

- `tests/unit/test_credential_crypto.ts` — Test encryption round-trip, Base64 migration
- `tests/unit/test_rate_limiter.ts` — Test rate limiting thresholds
- `tests/unit/test_db_zod_validation.ts` — Test Zod schema validation for conversation types

**Verification:** `npm test && npm start` (app boots, conversations load)

---

### PHASE 1: Stubs + UX Polish

**Branch:** `foundry/phase-1-stubs-ux`
**Team:** 2 agents (renderer-stubs + renderer-ux)
**Estimated time:** 3-4 hours

#### Task 1.1: Stub Card Component

**Agent:** renderer-stubs
**Files to create:**

- NEW `src/renderer/components/StubCard.tsx` — File card component for completed stubs
  - Props: filename, fileType, lineCount, size, onOpen, onCopy, onDownload
  - Shows: file icon, filename, type badge, line count
  - Click → emits `preview.open` event
  - Copy button, Download button
  - Multiple stubs → "Download All" as zip
  - Styled with UnoCSS atomic classes + Foundry theme colors

**Files to modify:**

- `src/renderer/messages/MessagetText.tsx` — Detect file content in messages, render StubCard instead of raw code for file outputs
- `src/renderer/components/Markdown.tsx` — Code block threshold branching:
  - <20 lines: inline with syntax highlight + copy
  - 20-50 lines: collapsed with gradient fade + "Show more"
  - 50+ lines: StubCard → opens in Preview

**Acceptance criteria:**

- Generated files appear as clean cards in chat
- Code blocks collapse appropriately by length
- Click opens in Preview panel
- Copy/Download buttons work

#### Task 1.2: Stub Streaming View

**Agent:** renderer-stubs
**Files to create:**

- NEW `src/renderer/components/StubStream.tsx` — Live creation view
  - Collapsible box showing content being generated
  - Max-height constraint with scroll
  - Progress: "Creating Apple.md..." with live line count
  - Transition: streaming → completed → StubCard

**Files to modify:**

- `src/renderer/messages/MessagetText.tsx` — During streaming (message status check), show StubStream instead of raw text for file-like content

**Acceptance criteria:**

- During generation, user sees live streaming in collapsible box
- After completion, settles into StubCard
- Can expand/collapse during streaming

#### Task 1.3: Sidebar Three-Dot Menu

**Agent:** renderer-ux
**Files to modify:**

- `src/renderer/pages/conversation/ChatHistory.tsx` — Replace hover Edit/Delete with three-dot dropdown
- `src/renderer/pages/conversation/WorkspaceGroupedHistory.tsx` — Same treatment

**Dropdown items:** Rename, Duplicate, Pin to Top, Archive, Export (MD/JSON), Delete (with confirmation)

**Files to create:**

- NEW `src/renderer/components/ConversationContextMenu.tsx` — Reusable dropdown component

**Acceptance criteria:**

- Three-dot icon visible on hover per conversation
- All menu items functional
- Delete has confirmation modal
- Export generates MD or JSON file

#### Task 1.4: Conversation Search

**Agent:** renderer-ux
**Files to modify:**

- `src/process/database/index.ts` — Re-add FTS5 search across conversations
- `src/process/bridge/conversationBridge.ts` — Add search IPC handler
- `src/preload.ts` — Expose search IPC channel

**Files to create:**

- NEW `src/renderer/components/ConversationSearch.tsx` — Search bar component
  - Appears at top of sidebar
  - Real-time search across conversation names + content
  - Results grouped by project (if applicable)

**Files to modify:**

- `src/renderer/pages/conversation/ChatSider.tsx` — Integrate search bar

**Acceptance criteria:**

- Search input at top of sidebar
- Typing filters conversations in real-time
- Results show conversation name with matched text highlight
- Works across all conversation types

#### Phase 1 Tests

**Files to create:**

- `tests/unit/test_stub_card.tsx` — StubCard rendering, click handlers
- `tests/unit/test_conversation_search.ts` — FTS search functionality

**Verification:** `npm start` → create a conversation → send a message that generates a file → verify StubCard appears → verify search works

---

### PHASE 2: Constitution Integration

**Branch:** `foundry/phase-2-constitution`
**Team:** 2 agents (platform + renderer)
**Estimated time:** 2-3 hours

#### Task 2.1: Replace In-Repo Constitution

**Agent:** platform
**Files to modify:**

- `.specify/memory/constitution.md` — Replace with new 522-line version from `C:\Users\seand\Downloads\CONSTITUTION.md`
- NEW `.foundry/constitution.md` — Copy of new constitution (canonical location)

#### Task 2.2: Constitution Loading into Agent System Prompts

**Agent:** platform
**Files to modify:**

- `src/process/task/GeminiAgentManager.ts` — Load constitution, inject into system prompt
- `src/process/task/BaseAgentManager.ts` — Add constitution loading as common behavior
- `src/agent/gemini/cli/config.ts` — Constitution as part of Gemini config
- `CLAUDE.md` — Update with Constitution rules for Claude Code agents

**Files to create:**

- NEW `src/process/services/constitutionService.ts` — Load, parse, and cache constitution. Return softcoded defaults. Provide constitution content for injection.

**Acceptance criteria:**

- Constitution loads from `.foundry/constitution.md` (project) or app default
- Agent system prompts include Constitution rules
- Softcoded defaults are parseable

#### Task 2.3: Constitution Settings UI

**Agent:** renderer
**Files to create:**

- NEW `src/renderer/pages/settings/ConstitutionSettings.tsx` — Read-only Constitution viewer
  - Syntax-highlighted markdown rendering
  - Shows version, last amended date
  - "Human-only" badge
  - Softcoded defaults panel (editable sliders/toggles)

**Files to modify:**

- `src/renderer/pages/settings/SettingsSider.tsx` — Add "Constitution" menu item
- `src/renderer/router.tsx` — Add `/settings/constitution` route
- `src/renderer/components/SettingsModal/index.tsx` — Add Constitution tab

**Acceptance criteria:**

- Constitution visible in Settings as read-only document
- Softcoded defaults are editable (verbosity, confirmation threshold, etc.)
- Changes persist in electron-store

#### Task 2.4: Context Budget Allocator

**Agent:** platform
**Files to create:**

- NEW `src/common/utils/contextBudget.ts` — Token budget allocator per agent type
  - Input: agent type, available context (Gemini 1M, Claude 200K, Codex 128K)
  - Allocates: constitution (fixed), skills (capped), memory (dynamic), conversation (remainder)
  - Auto-scales: if memory chunks exceed budget, reduce to top-K most relevant

**Files to modify:**

- `src/process/task/GeminiAgentManager.ts` — Use context budget when building system prompt

**Acceptance criteria:**

- Context injection never exceeds agent's context limit
- Memory is dynamically sized based on available budget
- Constitution + skills always fit (they're small)

#### Phase 2 Tests

**Files to create:**

- `tests/unit/test_constitution_service.ts` — Load, parse, cache
- `tests/unit/test_context_budget.ts` — Budget allocation for different agent types

**Verification:** `npm start` → Settings → Constitution tab → verify content renders → start a Gemini conversation → verify constitution appears in agent behavior

---

### PHASE 3: Projects Foundation

**Branch:** `foundry/phase-3-projects`
**Team:** 3 agents (platform + renderer + agents)
**Estimated time:** 4-5 hours

#### Task 3.1: Project Service

**Agent:** platform
**Files to create:**

- NEW `src/process/services/projectService.ts`:
  - `detectProject(workspacePath)` — Check for `.foundry/` folder
  - `initProject(workspacePath, metadata)` — Create `.foundry/project.json`, instructions.md
  - `readProject(workspacePath)` — Load project.json, instructions, skills
  - `listProjects()` — Scan known workspaces for `.foundry/` folders
  - `archiveProject(workspacePath)` — Set archived flag
  - `deleteProject(workspacePath)` — Remove `.foundry/` (with confirmation)
- NEW `src/process/bridge/projectBridge.ts` — IPC bridge for project operations
- `src/process/bridge/index.ts` — Register projectBridge
- `src/preload.ts` — Expose project IPC channels

#### Task 3.2: Project Context Loading

**Agent:** agents
**Files to modify:**

- `src/process/task/GeminiAgentManager.ts` — On conversation start, check workspace for `.foundry/`, load instructions + skills
- `src/process/task/BaseAgentManager.ts` — Add project context loading as hook
- `src/agent/gemini/cli/config.ts` — Accept project instructions as additional system prompt content

**Acceptance criteria:**

- When conversation workspace has `.foundry/instructions.md`, it's injected into agent prompt
- Skills from `.foundry/skills/*.md` are loaded and injected
- Context budget allocator (Task 2.4) manages the total injection size

#### Task 3.3: Project UI — Sidebar + Home Page

**Agent:** renderer
**Files to modify:**

- `src/renderer/sider.tsx` — Add "New Project" option to sidebar (dropdown: New Chat / New Project)
- `src/renderer/pages/guid/index.tsx` — Home page project cards (2 rows of 3, recent projects with name, description, last active)

**Files to create:**

- NEW `src/renderer/components/ProjectCard.tsx` — Project card for home page
- NEW `src/renderer/components/ProjectWizard.tsx` — Mini wizard (name, description, workspace, project type, optional template)

**Acceptance criteria:**

- "New Project" in sidebar opens wizard
- Wizard creates workspace with `.foundry/` structure
- Home page shows recent projects as clickable cards
- Clicking project card opens project view

#### Task 3.4: "Promote to Project"

**Agent:** renderer
**Files to modify:**

- `src/renderer/components/ConversationContextMenu.tsx` (from Task 1.3) — Add "Promote to Project" option
- Show only for conversations with workspaces that don't already have `.foundry/`

**Acceptance criteria:**

- Existing workspace conversation can be promoted
- Creates `.foundry/` with basic metadata from existing conversation
- Conversation continues working normally after promotion

#### Task 3.5: Multi-Chat Per Project

**Agent:** platform
**Files to modify:**

- `src/process/services/conversationService.ts` — Query conversations by workspace path
- `src/process/bridge/conversationBridge.ts` — Add getConversationsByWorkspace handler

**Agent:** renderer (depends on platform)
**Files to modify:**

- `src/renderer/pages/guid/index.tsx` — Project card click → show all conversations for that project

**Acceptance criteria:**

- Multiple conversations can share the same workspace
- Project view lists all conversations
- Each conversation gets its own session in shared `.foundry/` context

#### Phase 3 Tests

**Files to create:**

- `tests/unit/test_project_service.ts` — detect, init, read, list, archive, delete
- `tests/unit/test_project_context_loading.ts` — Instructions + skills injection

**Verification:** `npm start` → New Project → create project → verify `.foundry/` created → start conversation → verify instructions loaded → create second conversation in same project → verify shared context

---

### PHASE 4: Error Recovery + Degradation

**Branch:** `foundry/phase-4-resilience`
**Team:** 1 agent (platform)
**Estimated time:** 1-2 hours

#### Task 4.1: Graceful Degradation Framework

**Files to create:**

- NEW `src/common/utils/gracefulDegradation.ts`:
  - `tryWithFallback<T>(primary: () => T, fallback: () => T, errorLabel: string): T`
  - `serviceHealth` registry — track which services are healthy
  - `reportDegraded(service, reason)` — log + surface to UI

**Files to modify:**

- `src/renderer/context/LayoutContext.tsx` — Add degradation banner support
- NEW `src/renderer/components/DegradationBanner.tsx` — "Feature X is running in limited mode" banner

**Acceptance criteria:**

- When a service fails (e.g., constitution loading), app continues with degraded behavior
- User sees a non-intrusive banner explaining what's limited
- Errors logged to `.foundry/logs/` when in a project

---

### PHASES 5-12: Detailed Task Breakdown

_These phases are larger and documented at the feature level. The swarm lead should break each into 5-6 teammate-sized tasks following the pattern above._

#### Phase 5: Persistent Memory

- Spike: sqlite-vec + ONNX Runtime in Electron (MUST pass before proceeding)
- `src/process/services/memoryService.ts` — Ingest, chunk, embed, store, hybrid search
- `src/process/services/embeddingService.ts` — ONNX Runtime + bge-micro-v2
- `src/process/bridge/memoryBridge.ts` — IPC bridge
- `src/renderer/pages/settings/MemorySettings.tsx` — Memory management UI
- Session summary generation post-conversation
- User profile learning

#### Phase 6: Editing Suite (TipTap)

- Install TipTap dependencies
- NEW `src/renderer/components/FoundryDocEditor.tsx` — TipTap WYSIWYG
- Replace `MarkdownEditor.tsx` in Preview with TipTap
- Keep CodeMirror for HTML/text source
- Keep Monaco for code

#### Phase 7: Skill Store

- `src/renderer/pages/settings/SkillSettings.tsx` — Skill management UI
- `src/process/services/skillService.ts` — Import, export, security audit
- `src/process/services/skillSecurityAudit.ts` — Pattern matching + injection detection
- Bundled skills from chip library
- "Generate a skill" button

#### Phase 8: MCP Store

- `src/renderer/pages/settings/McpStoreSettings.tsx` — Browse/search/install UI
- `src/process/services/mcpStoreService.ts` — Fetch from repos, auto-update
- Pre-bundle 24+ popular MCPs
- Health check + connection testing

#### Phase 9: Ember Core

- `src/process/services/emberService.ts` — Core Ember logic
- Persistent worker architecture (not per-conversation)
- "Ember, ..." invocation parsing
- Personality system
- Activity feed UI
- Autonomy levels

#### Phase 10: Voice Mode

- OpenAI Whisper STT integration
- ElevenLabs + OpenAI TTS integration
- Desktop microphone in SendBox
- Channel voice handling

#### Phase 11: Additional Channels

- Remove Lark plugin
- Slack plugin
- WhatsApp plugin
- Discord plugin
- Signal plugin

#### Phase 12: Browser Agent

- Browser action tool interfaces (navigate, click, fill, screenshot, extract, wait)
- Register in conversation-tool-config.ts
- Screenshot feedback in chat
- Multi-step approval flow

---

### Rollback Strategy

**Per-phase branches:**

```
git checkout -b foundry/phase-0-foundation
# ... work ...
git add -A && git commit -m "feat: Phase 0 complete"
git checkout -b foundry/phase-1-stubs-ux
# ... work ...
```

**If phase fails:**

```
git checkout foundry/phase-N-1-previous  # go back to last good state
git branch -D foundry/phase-N-failed     # delete failed branch
```

**Nuclear rollback:**

```
git checkout main  # back to current main
```

---

### CLAUDE.md Updates for Swarm Mode

The CLAUDE.md file must be updated to include:

1. **Current build state** — What's working, what's in progress
2. **File ownership rules** — Which teammates own which directories
3. **Constitution reference** — Point to `.foundry/constitution.md`
4. **Testing requirements** — Every change must have tests
5. **Swarm coordination rules:**
   - Never edit files outside your ownership boundary
   - Shared files (`package.json`, `src/common/types/`) → only the lead edits
   - Run `npm test` after every phase
   - Report blockers immediately via mailbox
   - Use git branches per phase

### Custom Subagent Files to Create

Create these in `.claude/agents/`:

1. **`.claude/agents/foundry-renderer.md`** — Frontend specialist
2. **`.claude/agents/foundry-platform.md`** — Backend specialist
3. **`.claude/agents/foundry-security.md`** — Security + channels specialist
4. **`.claude/agents/foundry-agents.md`** — Agent + tools specialist
5. **`.claude/agents/foundry-tester.md`** — Testing QA specialist
6. **`.claude/agents/foundry-reviewer.md`** — Code review specialist

---

## References

- **Foundry Kickstart Framework:** `foundry-kickstart.md` — 13-phase discovery, output templates
- **Skill Library:** `foundry-chip-library.md` — 30+ domain expertise skills (7 categories)
- **Constitution (new):** `CONSTITUTION.md` — 522-line governance document (principal hierarchy, action classification, memory tiers, enforcement model)
- **Constitution (in-repo):** `.specify/memory/constitution.md` — v1.0.0, basic version to be replaced
- **OpenClaw:** 145K+ GitHub stars, TypeScript daemon, ClawHub registry, heartbeat system, hybrid memory
- **Nanobot:** ~4K lines Python, MCP-based, multi-channel daemon, cron scheduling
- **TipTap:** v3.19.0, ProseMirror-based WYSIWYG, `@tiptap/react`, ~100-150KB gzipped
- **sqlite-vec:** Vector search extension for SQLite (works with better-sqlite3)
- **ONNX Runtime:** Cross-platform ML inference, bge-micro-v2 embeddings (22.9MB)
- **Existing Editors:** TextEditor (CodeMirror), MarkdownEditor (CodeMirror + markdown syntax), HTMLEditor (CodeMirror + html), Monaco in HTMLViewer only
- **Channel Security:** Base64 credentials, no rate limiting, no prompt injection defense, 6-digit pairing codes
- **Claude Code Agent Teams:** [Official Docs](https://code.claude.com/docs/en/agent-teams) — Research preview, shipped Feb 5 2026 with Opus 4.6
- **Claude Code Custom Subagents:** [Official Docs](https://code.claude.com/docs/en/sub-agents) — `.claude/agents/*.md` with YAML frontmatter
- **Claude Agent SDK:** [Overview](https://platform.claude.com/docs/en/agent-sdk/overview) — Programmatic agent orchestration, TypeScript + Python
- **Anthropic C Compiler Blog:** [Engineering Blog](https://www.anthropic.com/engineering/building-c-compiler) — Flagship agent teams demonstration
- **claude-flow:** [GitHub](https://github.com/ruvnet/claude-flow) — Open-source agent orchestration with swarm intelligence
- **ChatGPT Desktop App:** Competitor with memory, custom GPTs, voice, canvas
- **Cursor / Windsurf:** AI code editor competitors for "AI dev platform" positioning
