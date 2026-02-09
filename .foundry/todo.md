# Foundry — Active Tasks

> Updated: 2026-02-09 (Session 11)
> Full roadmap: `BATTLEPLAN.md` | Vision: `.foundry/VISION.md`

---

## Completed: Phase 1.5 — SendBox UX Overhaul ✓ (Session 5)

### Phase 1.5: SendBox UX (from MiniMax/Claude.ai reference)

- [x] **1.5.1** Suggested Action Pills — `SuggestedActionPills.tsx` + wired into GeminiChat, CodexChat, AcpChat
- [x] **1.5.2** Action pill templates — `ActionTemplates` component + `sendbox.fill` event integration
- [x] **1.5.3** SendBox Settings Popover — `SendBoxSettingsPopover.tsx` + wired into all 3 SendBoxes
- [x] **1.5.4** Model Mode Selector — `ModelModeSelector.tsx` + wired into all 3 SendBoxes
- [ ] **1.5.5** MCP-Powered Suggestions — deferred to Phase 8 (needs MCP Store)
- [x] **1.5.6** Voice mode button placeholder — `VoiceModeButton.tsx` + wired into all 3 SendBoxes

---

## Completed: Phase 3 — Projects Foundation ✓ (Session 5)

### Phase 3: Projects Foundation

- [x] **3.1** `projectService.ts` — detect, init, read, list, archive, delete, loadInstructions, loadSkills
- [x] **3.1** `projectBridge.ts` — IPC bridge + `ipcBridge.project.*` channels + registered in bridge/index.ts
- [x] **3.2** Project context loading — `agentUtils.ts` extended: `.foundry/instructions.md` + `.foundry/skills/*.md` injected into ALL agents (Gemini, ACP, Codex)
- [x] **3.3** `ProjectCard.tsx` — project card with type badge, metadata, menu (archive/delete)
- [x] **3.3** `ProjectWizard.tsx` — 4-step modal wizard (basics → type/workspace → goals → review)
- [x] **3.3** Sidebar "New Project" button + ProjectWizard integration
- [x] **3.3** Guid page ProjectCards grid (recent 6 projects above agent selector)
- [x] **3.4** "Promote to Project" in ConversationContextMenu (with project detection)
- [x] **3.5** Multi-chat per project — `project.getConversations` IPC, workspace-based filtering

### Phase 4: Resilience ✓

- [x] gracefulDegradation.ts — `tryWithFallback()`, service health registry, pub/sub listeners
- [x] DegradationBanner.tsx — auto-show/dismiss, yellow (degraded) / red (down), wired into layout.tsx

### Phase 5: Persistent Memory ✓ (Session 6)

- [x] **5.1** DB migration v14 — `memory_chunks` table + FTS5 virtual table + triggers + `user_profile` table
- [x] **5.2** `memoryService.ts` — store, chunk, sanitize (credential filtering), FTS5/BM25 search, recency+importance weighted retrieval, user profile learning, `buildMemoryContext()` for agent injection
- [x] **5.3** `sessionSummaryService.ts` — Gemini Flash extracts summary, decisions, lessons, preferences from conversations. Stores as typed memory chunks.
- [x] **5.4** `memoryBridge.ts` — Full IPC bridge (search, list, store, remove, profile CRUD, stats, extractSession). Registered in bridge/index.ts
- [x] **5.5** Agent injection — `agentUtils.ts` extended: `buildMemoryContext()` loaded into both `buildSystemInstructions` (Gemini) and `prepareFirstMessageWithSkillsIndex` (ACP/Codex). Uses 15% context budget.
- [x] **5.6** Session extraction triggers — All 3 SendBoxes (Gemini, Codex, ACP) call `memory.extractSession` when `running` transitions true→false
- [x] **5.7** Memory Settings UI — `MemoryModalContent.tsx` in Settings modal. Stats, user profile viewer, searchable memory list, delete/clear actions.
- [ ] **5.S** Spike: sqlite-vec + ONNX Runtime for vector embeddings (deferred — FTS5/BM25 works now, vector can be added later)

### Phase 6: Editing Suite ✓ (Session 7)

- [x] **6.1** `FoundryDocEditor.tsx` — TipTap WYSIWYG editor with toolbar (headings, bold/italic/strike, lists, blockquote, code blocks). Exported from editors/index.ts
- [x] **6.2** Wire into PreviewPanel as WYSIWYG "Edit" tab — TipTap ↔ markdown via marked + turndown (Session 9)

### Phase 7: Skill Store ✓ (Session 7)

- [x] **7.1** `skillSecurityAudit.ts` — 12 security audit rules (prompt injection, shell invocation, credential exfil, obfuscation)
- [x] **7.2** `SkillStoreModalContent.tsx` — 20 curated skills, 7 categories, search/filter, import. Wired into SettingsModal (Lightning icon)
- [ ] **7.3** "Generate a Skill" flow (deferred — needs AI generation pipeline)

### Phase 8: MCP Store ✓ (Session 7)

- [x] **8.1** `mcpStoreService.ts` — 24 curated MCP servers (Anthropic + community) with install templates
- [x] **8.2** `McpStoreModalContent.tsx` — Browse/search/install UI with one-click install. Wired into SettingsModal (PlugOne icon)
- [ ] **8.3** Per-project `.foundry/mcp.json` config (deferred)

### Phase 9: Ember Core ✓ (Session 8)

- [x] **9A.1** `emberService.ts` — Intent classification (pattern matching + LLM), Gemini Flash brain, memory enrichment, activity log
- [x] **9A.2** `emberPersonality.ts` — 5 personalities, 3 autonomy levels, system prompt builder
- [x] **9A.3** `emberBridge.ts` — IPC bridge (send, getActivity, getConfig, setConfig, resetConversation)
- [x] **9B.1** `EmberChat.tsx` — Chat UI with local state, message bubbles, empty state
- [x] **9B.2** `EmberSendBox.tsx` — Minimal textarea + send button
- [x] **9B.3** `EmberModalContent.tsx` — Settings: personality, autonomy, custom prompt, activity feed
- [x] **9B.4** Conversation type integration — storage.ts, ChatConversation.tsx, SettingsModal, draft store, tab context
- [ ] **9.F** Full CronService integration for Ember scheduling (deferred)
- [ ] **9.F** WorkerManage integration for routing to CLI agents (deferred)

### Phase 10: Voice Mode ✓ (Session 8)

- [x] **10.1** `voiceService.ts` — Whisper STT + OpenAI TTS + temp file management
- [x] **10.2** `voiceBridge.ts` — IPC bridge (transcribe, synthesize, saveRecording, getConfig, setConfig)
- [x] **10.3** `VoiceModeButton.tsx` — MediaRecorder capture, 3-state UI, duration timer
- [x] **10.4** IPC types in ipcBridge.ts
- [ ] **10.F** ElevenLabs TTS provider (deferred — OpenAI TTS works now)
- [x] **10.F** Voice settings in SettingsModal — `VoiceModalContent.tsx` ✓ (Session 10)

### Phase 11: Channels ✓ (Session 8)

- [x] **11.1** WhatsApp — WhatsAppPlugin.ts + WhatsAppAdapter.ts (Baileys SDK)
- [x] **11.2** Discord — DiscordPlugin.ts + DiscordAdapter.ts (discord.js)
- [x] **11.3** Slack — SlackPlugin.ts + SlackAdapter.ts (@slack/bolt)
- [x] **11.4** Signal — SignalPlugin.ts + SignalAdapter.ts (signal-cli-rest-api)
- [x] **11.5** ChannelManager.ts — all 4 plugins registered
- [x] **11.F** Remove Lark channel — deleted 5 files, updated 7 dependent files ✓ (Session 10)

### Security Audit ✓ (Session 8)

- [x] **SA.1** Path traversal fix in voiceService.ts (assertSafePath + format whitelist)
- [x] **SA.2** SSRF prevention in SignalPlugin.ts (URL validation, blocked internal hosts)
- [x] **SA.3** WhatsApp auth path hardened (resolved to app data dir)
- [x] **SA.4** Ember input length validation (10K char limit at bridge)
- [x] **SA.5** WhatsApp reconnect loop guarded (backoff + max 5 attempts)
- [x] **SA.F** Extend encryptCredentials to cover all sensitive fields — generic `<T extends object>` ✓ (Session 10)
- [x] **SA.F** Rate limiting on Ember/Voice API calls — 30 req/min via RateLimiter ✓ (Session 10)

### Phase 12: Browser Agent ✓ (Session 10)

- [x] **12.1** `browser-session.ts` — Playwright singleton extracted from web-fetch.ts + BrowserSessionManager (persistent sessions per conversation, 30-min idle cleanup)
- [x] **12.2** `browser-navigate.ts` — Navigate to URL + auto-screenshot feedback to LLM
- [x] **12.3** `browser-screenshot.ts` — Capture page as PNG, inline image data
- [x] **12.4** `browser-extract.ts` — Extract text from page or CSS selector (100K char max)
- [x] **12.5** `browser-click.ts` — Click element with confirmation + post-click screenshot
- [x] **12.6** `browser-fill.ts` — Fill form field with confirmation + post-fill screenshot
- [x] **12.7** `browser-wait.ts` — Wait for selector/navigation/load events
- [x] **12.8** Registration in `conversation-tool-config.ts` + `useBrowserAgent` flag
- [x] **12.9** Browser category in `MessageToolGroupSummary.tsx`

### Deferred Items (1.2)

- [x] **1.2** `StubStream.tsx` — animated skeleton placeholder for active code generation ✓ (Session 10)

### Product Audit Fixes ✓ (Session 10)

- [x] **A.1** SendBoxSettingsPopover — rewired to be self-contained with real MCP data + navigate links
- [x] **A.2** ModelModeSelector — removed (was hardcoded placeholder, Gemini has its own selector)
- [x] **A.3** Ember conversation creation — added to guid page agent selector + IPC + ConversationService
- [x] **A.4** Channel config forms — replaced "coming soon" placeholders with real GenericChannelConfigForm (Discord, Slack, WhatsApp, Signal)
- [x] **A.5** File download button — added to StubCard.tsx + Markdown.tsx code blocks
- [x] **A.6** StubStream wiring — shown in ThinkingFooter during code-related tool execution
- [x] **A.7** "New Image" sidebar flow — sidebar button, agent selector pill, ChatConversation.tsx routing activated

### Product Polish Sprint ✓ (Session 11)

- [x] **PP.0** Critical: Fix `searchConversations` — `modify_time`/`create_time` → `updated_at`/`created_at` + `rowToConversation()` (databaseBridge.ts)
- [x] **PP.A1** Ember auto-select from sidebar nav state (guid/index.tsx)
- [x] **PP.A2** Show 10 recent conversations by default (SidebarRecentsSection.tsx)
- [x] **PP.A3** Remove Schedule from sidebar nav (SidebarNav.tsx)
- [x] **PP.B1** Wider project cards with left accent border (ProjectsPage.tsx, ProjectCard.tsx)
- [x] **PP.B2** ProjectDetailPage two-column layout — left: description+conversations, right: Instructions/Files/Activity cards
- [x] **PP.C1** Channels breakout — own Settings page + step-by-step setup guides (Discord, Slack, WhatsApp, Signal)
- [x] **PP.C1** Renamed WebUI → Remote Access
- [x] **PP.C2** About page redesign — tagline, tech badges, removed old contact info
- [x] **PP.C2** Version bump `1.8.2` → `2.0.0`
- [x] **PP.C3** Ember model selector — configurable Gemini Flash model + autonomy tooltips
- [x] **PP.C4** Voice preview button — synthesize + play sample audio
- [x] **PP.C5** Memory improvements — Add Memory form (fact/preference/decision), inline profile editing, tooltips
- [x] **PP.C6** Constitution — search/filter on principles, source indicator (Default vs Custom)
- [x] **PP.C7** Tooltips across settings — Voice providers, Ember autonomy, Memory stats/types
- [x] **PP.D1** Skills Store — expandable detail view, custom skill delete, URL import
- [x] **PP.D2** MCP Store — expanded catalog (24 → 36 servers: Google Workspace, Calendar, Gmail, Sheets, Todoist, Jira, Obsidian, Vercel, AWS, Perplexity, Dropbox)
- [x] **PP.BF1** Fix Channels navigation — missing `/settings/channels` route (new ChannelsSettings.tsx page)
- [x] **PP.BF2** Fix memory textarea placeholder color (white-on-white → `placeholder:text-t-tertiary`)
- [x] **PP.BF3** Add memory editing — click content → inline textarea → delete+re-store

---

## Upcoming: Skills Marathon (Session 12)

Dedicated session to build out the Foundry skill ecosystem. Target: 100+ production-quality skills.

### Research Phase

- [ ] **SM.1** Audit community skill catalogs (OpenClaw 2,999 skills, SkillCreatorAI, awesome-lists)
- [ ] **SM.2** Identify top 100 skill domains across: Development, DevOps, Data Science, Design, Writing, Marketing, Legal, Finance, Education, Operations, Product, Creative, Security, Research, HR, Sales, Support
- [ ] **SM.3** Define quality bar — each skill must have: clear rules, structured output format, edge case handling, security audit pass

### Generation Phase

- [ ] **SM.4** Generate skills in batches of 10-15 per domain using best-in-class examples as seeds
- [ ] **SM.5** Each skill gets: SKILL.md (YAML frontmatter + markdown body), detailed rules, example prompts, audit results
- [ ] **SM.6** Cross-reference with existing community skills — consolidate and enhance rather than duplicate

### Import & Enhance Feature

- [ ] **SM.7** "Import and Enhance" flow — fetch external skill → security audit → LLM refinement → polished output
- [ ] **SM.8** Skill builder UI — guided wizard to create skills from scratch (powered by configurable model)
- [ ] **SM.9** Skill quality scoring — automated rating based on rule clarity, coverage, security audit results

### Infrastructure

- [ ] **SM.10** Skill versioning — track skill updates, allow rollback
- [ ] **SM.11** Skill dependencies — skills that reference or extend other skills
- [ ] **SM.12** Community sharing — export skill as shareable URL/package

### MCP Store Expansion (Bonus)

- [ ] **SM.13** Research `taylorwilsdon/google_workspace_mcp` + other high-quality community MCP servers
- [ ] **SM.14** Add security filtering for MCP imports (similar to skill audit pipeline)
- [ ] **SM.15** Embedded Google Workspace MCP as default-available connector
- [ ] **SM.16** Dropbox MCP connector with proper OAuth flow

---

## Completed

### Phase 0: DB Migration + Security Hardening ✓ (Session 4)

- [x] **0.1** Remove DB CHECK constraints → Zod validation (`schema.ts`, `migrations.ts`, `types.ts`)
- [x] **0.2** Real credential encryption — AES-256-GCM via `safeStorage` (`credentialCrypto.ts`)
- [x] **0.3** Rate limiting + stronger pairing (`rateLimiter.ts`, `PairingService.ts`)
- [x] **0.4** Remove debug `console.log` — verified clean
- [ ] **0.T** Tests: `test_credential_crypto.ts`, `test_rate_limiter.ts`, `test_db_zod_validation.ts` (deferred)
- [ ] **0.V** Verify: `npm test && npm start` → app boots, conversations load (pending)
- [ ] **0.S** Spike sqlite-vec + ONNX Runtime in Electron on Windows (deferred to Phase 5)

### Phase 1: Stubs + UX Polish ✓ (Session 4)

- [x] **1.1** StubCard.tsx + code block thresholds in Markdown.tsx (<20 inline, 20-50 collapsed, 50+ StubCard)
- [x] **1.2** StubStream.tsx — animated skeleton placeholder for active code generation ✓ (Session 10)
- [x] **1.3** ConversationContextMenu.tsx — three-dot dropdown (rename, export, delete)
- [x] **1.4** ConversationSearch.tsx — sidebar search with debounce + Ctrl+K shortcut

### Phase 2: Constitution Integration ✓ (Session 4)

- [x] **2.2** constitutionService.ts — load, parse, cache, format for prompts
- [x] **2.3** Constitution Settings UI — ConstitutionModalContent.tsx + SettingsModal tab wired
- [x] **2.4** contextBudget.ts — token budget allocator per agent type
- [x] **2.5** agentUtils.ts — constitution + skills injection into agent system prompts

### Previous Sessions

- [x] Rebrand AionUI → Foundry (1,620 refs across 452 files)
- [x] SDK streaming for Claude, Gemini, OpenAI
- [x] Connection status banner, stop button, partial response preservation
- [x] Error categorization with actionable guidance
- [x] WebFetch — 3-tier: Playwright stealth → Jina Reader → direct fetch
- [x] WebSearch — Jina + DuckDuckGo fallback
- [x] Persistent thinking indicator (finishBridgeRef)
- [x] Dynamic thinking indicator with Foundry phrases
- [x] Model-aware suggested replies (suggestionService)
- [x] Clean Slate theme (neutral grays + #ff6b35 orange)
- [x] User/AI message distinction, file preview tooltips, confidence badges
- [x] Keyboard shortcuts, throughput indicator, collapsible tool summaries
- [x] Image generation backend (imageGenerationService.ts) — fully wired: sidebar "New Image" button, agent selector pill, ChatConversation routing, ImageChat UI
- [x] Channels Phase 1 — Telegram + Lark (Lark to be removed)
- [x] Image gen bug fixes (7 items, 2026-02-08)

---

## GitHub Research (Session 4)

Investigated 5 repos per user request:

- **microsoft/agent-lightning** (14.3k★) — RL training framework. REFERENCE only. Trace architecture concept interesting for future analytics.
- **nextlevelbuilder/ui-ux-pro-max-skill** (29.5k★) — SKILL.md format is instructive. REFERENCE.
- **VoltAgent/awesome-openclaw-skills** (11.6k★) — 2,999 curated skills. Quality-gating patterns valuable for skill marketplace. REFERENCE.
- **skillcreatorai/Ai-Agent-Skills** (757★) — Cross-platform installer. SKILL.md (YAML frontmatter + markdown) is de facto standard. REFERENCE.
- **aitytech/agentkits-marketing** (264★) — Domain-specific marketing. SKIP.

**Key takeaway:** SKILL.md (YAML frontmatter + markdown body + optional scripts/ and references/) is becoming the standard skill format. Adopt this for Foundry's skill system (Phase 7).
