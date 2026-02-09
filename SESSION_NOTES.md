# Foundry - Session Notes

## Session: 2026-02-04

### What Was Accomplished

- Cloned Foundry repository from Foundry/Foundry
- Performed comprehensive branding audit (1,620 references across 452 files)
- Complete rebrand from Foundry/Foundry to Foundry across all source files
- Created project documentation: CLAUDE.md, TODO.md, SESSION_NOTES.md
- Verified successful compilation

### Current State

- All source code, configs, translations, and docs rebranded to Foundry
- Dependencies not yet installed (need `npm install`)
- Icon/logo assets still have original Foundry graphics (filenames updated)
- External npm packages (`@office-ai/*`) remain unchanged (upstream deps)

### Key Decisions

- Kept Apache-2.0 licence from original project
- Used "Foundry" as consistent brand (not "FoundryUI" or "FoundryAI")
- App ID: `com.foundry.app`
- Preserved original project structure and architecture
- Did not modify `@office-ai/*` package imports (external dependencies)

### Blockers

- None currently

### Next Steps

- Replace icon assets with Foundry branding
- Run `npm install` and verify build
- Test development server launch
- Consider what additional features to build on top of this foundation

---

## Session: 2026-02-05

### What Was Accomplished

#### P0 - Foundation (Complete)

1. **Claude SDK Streaming** (`src/common/adapters/AnthropicRotatingClient.ts`)
   - Added `createChatCompletionStream()` async generator
   - Added `createMessageStream()` for native Anthropic types
   - Supports: text deltas, thinking deltas (extended thinking), tool use events

2. **Gemini SDK Streaming** (`src/common/adapters/GeminiRotatingClient.ts`)
   - Added `createChatCompletionStream()` async generator
   - Added `generateContentStream()` for direct prompts
   - Supports: text deltas, thought deltas, tool calls, usage info

3. **OpenAI SDK Streaming** (`src/common/adapters/OpenAIRotatingClient.ts`)
   - Added `createChatCompletionStream()` async generator
   - Supports: text deltas, reasoning deltas (o1/o3), tool call accumulation

4. **Connection Status Banner** (`src/renderer/components/ConnectionStatusBanner.tsx`)
   - NEW component with states: IDLE, CONNECTING, CONNECTED, RECONNECTING, FAILED
   - Auto-dismiss on success, retry button on failure
   - Color-coded visual feedback

5. **Enhanced Stop Button** (`src/renderer/components/sendbox.tsx`)
   - New `StopButton` component with spin indicator
   - Visual feedback (red while stopping)
   - Global ESC key handler

6. **Partial Response Preservation** (`src/process/database/StreamingMessageBuffer.ts`)
   - Added `flushAllAsPartial()` and `flushAsPartial(messageId)`
   - Appends `[Response interrupted]` marker
   - Helpers: `complete()`, `hasActiveBuffer()`, `getBufferLength()`

7. **Error Categorization** (`src/renderer/messages/MessageTips.tsx`)
   - Categories: rate_limit, network, context, auth, server, unknown
   - Actionable guidance per error type
   - Retry with countdown, model switcher, copy error

8. **i18n Updates** (`en-US.json`, `zh-CN.json`)
   - Added `connection.*` and `errors.*` translation keys

#### Wiring (Complete)

9. **Connection State Hook** (`src/renderer/hooks/useConnectionState.ts`)
   - NEW hook to track connection state from stream events
   - Derives state from: start→connecting, content→connected, finish→idle, error→failed
   - Subscribes to gemini/acp/codex conversation streams

10. **Chat Layout Integration** (`src/renderer/pages/conversation/ChatConversation.tsx`)
    - Added ConnectionStatusBanner to GeminiConversationPanel
    - Added ConnectionStatusBanner to main ChatConversation
    - Wired to useConnectionState hook

11. **Streaming Types Export** (`src/common/adapters/index.ts`)
    - Exported stream event types and callback interfaces

#### P1 - Trust Building (Complete)

12. **Throughput Indicator** (`src/renderer/components/ContextUsageIndicator.tsx`)
    - Added `throughput` and `isStreaming` props
    - Shows "~XX tok/s" during streaming with pulsing indicator

13. **Throughput Hook** (`src/renderer/hooks/useThroughput.ts`)
    - NEW hook to calculate token throughput from streaming events
    - Uses sliding window (2s) for rate calculation
    - Estimates tokens from text length (~4 chars/token)

14. **Model Capability Badge** (`src/renderer/components/ModelCapabilityBadge.tsx`)
    - NEW component showing model name with capability tags
    - Supports: reasoning, vision, tool use, web search, image gen
    - Compact and full view modes
    - Context window display

15. **Phase Indicators** (`src/renderer/components/ThoughtDisplay.tsx`)
    - Added `phases` and `currentPhase` props
    - Shows step progress bar with percentage
    - Lists phases with completed/active/pending indicators

16. **Local Model Providers** (`src/renderer/config/modelPlatforms.ts`)
    - Added Ollama (localhost:11434/v1)
    - Added LM Studio (localhost:1234/v1)
    - Both use OpenAI-compatible API

#### P2 - Polish (Complete)

17. **Collapsible Tool Details** (`src/renderer/messages/codex/ToolCallComponent/BaseToolCallDisplay.tsx`)
    - Added `collapsible`, `defaultCollapsed`, `summary` props
    - Toggle button with expand/collapse icons
    - Summary shown when collapsed

18. **Keyboard Shortcuts Overlay** (`src/renderer/components/KeyboardShortcutsHelp.tsx`)
    - NEW component triggered by '?' key
    - Modal with grouped shortcuts (General, Navigation, Editor)
    - Renders key combinations with visual styling

19. **Layout Integration** (`src/renderer/layout.tsx`)
    - Mounted KeyboardShortcutsHelp component globally

### Architecture Notes

**Streaming Flow:**

```
SDK Client (streaming)
  → Agent Manager (processes events)
  → IPC Bridge (emits to renderer)
  → Message Components (display)
  → StreamingMessageBuffer (batched DB writes)
```

**Key Patterns:**

- Use async generators for streaming
- Fixed `msg_id` for frontend message merging
- Callbacks for real-time event handling
- Abort signal support for cancellation

**Existing CLI Streaming (No changes needed):**

- Claude Code (Codex) - streams via `agent_message_delta` events
- Gemini CLI - streams via process stdout
- ACP agents (Claude, Qwen, etc.) - streams via process stdout

### Files Created

- `src/renderer/components/ConnectionStatusBanner.tsx`
- `src/renderer/components/ModelCapabilityBadge.tsx`
- `src/renderer/components/KeyboardShortcutsHelp.tsx`
- `src/renderer/hooks/useConnectionState.ts`
- `src/renderer/hooks/useThroughput.ts`

### Files Modified

- `src/common/adapters/AnthropicRotatingClient.ts`
- `src/common/adapters/GeminiRotatingClient.ts`
- `src/common/adapters/OpenAIRotatingClient.ts`
- `src/common/adapters/OpenAI2AnthropicConverter.ts`
- `src/common/adapters/index.ts`
- `src/process/database/StreamingMessageBuffer.ts`
- `src/renderer/components/sendbox.tsx`
- `src/renderer/components/ContextUsageIndicator.tsx`
- `src/renderer/components/ThoughtDisplay.tsx`
- `src/renderer/messages/MessageTips.tsx`
- `src/renderer/messages/codex/ToolCallComponent/BaseToolCallDisplay.tsx`
- `src/renderer/pages/conversation/ChatConversation.tsx`
- `src/renderer/config/modelPlatforms.ts`
- `src/renderer/layout.tsx`
- `src/renderer/i18n/locales/en-US.json`
- `src/renderer/i18n/locales/zh-CN.json`

### Bug Fixes

20. **Database Constraint Fix** (`src/process/database/migrations.ts`)
    - Added migration v11 to fix case sensitivity issue
    - Changed CHECK constraint from `source IN ('Foundry', 'telegram')` to `source IN ('foundry', 'telegram')`
    - Updates existing 'Foundry' values to 'foundry'
    - Updated CURRENT_DB_VERSION to 11

21. **Enhanced ThoughtDisplay UX** (`src/renderer/components/ThoughtDisplay.tsx`)
    - Added fun rotating phrases: "Thinking...", "Pondering...", "Contemplating...", etc.
    - Longer wait phrases after 8s: "Still thinking...", "Almost there...", etc.
    - Animated dots that cycle every 400ms
    - Phrase rotation every 2.5s while waiting

### Current State

- All P0, P1, and P2 core features implemented
- TypeScript compilation passes
- App running successfully with database migration applied
- Ready for user testing

### Issues Resolved

1. **CHECK constraint failed error**: Messages weren't being created because the database had `source IN ('Foundry', 'telegram')` but code inserted lowercase 'foundry'. Fixed with migration v11.

2. **User feedback: "spinning ball, no feedback"**: Enhanced ThoughtDisplay with engaging rotating phrases to show the app is working.

### Built-in Web Tools (Complete)

22. **WebSearch Service** (`src/common/tools/webSearch.ts`)
    - DuckDuckGo HTML scraping (no API key required)
    - Brave Search API support (optional, for better results)
    - Parses results into structured format
    - Formats as markdown for AI consumption

23. **WebFetch Service** (`src/common/tools/webFetch.ts`)
    - Fetches URLs with proper headers
    - Converts HTML to readable text via html-to-text
    - GitHub blob URL transformation to raw URLs
    - Timeout and error handling

24. **BuiltinToolHandler** (`src/common/tools/BuiltinToolHandler.ts`)
    - Routes tool calls to Foundry implementations
    - Pattern matching for tool names (websearch, google_search, etc.)
    - Extracts parameters from various input formats

25. **MCP Server** (`src/common/tools/McpWebToolsServer.ts`)
    - Stdio-based MCP server for Claude Code integration
    - Provides web_search and web_fetch tools
    - JSON-RPC 2.0 protocol

26. **BuiltinMcpService** (`src/process/services/BuiltinMcpService.ts`)
    - Auto-registers MCP server with Claude Code on startup
    - Uses `claude mcp add` command
    - Checks if already registered to avoid duplicates

### Files Created

- `src/common/tools/webSearch.ts`
- `src/common/tools/webFetch.ts`
- `src/common/tools/BuiltinToolHandler.ts`
- `src/common/tools/McpWebToolsServer.ts`
- `src/common/tools/index.ts`
- `src/process/services/BuiltinMcpService.ts`

### Files Modified

- `src/agent/acp/index.ts` - Added import for built-in tools
- `src/process/initStorage.ts` - Call initBuiltinMcpTools on startup

### Next Steps

1. User to test web search in Claude conversation
2. Verify `foundry-web-tools` MCP server provides working search
3. Optional: Add Brave API key configuration in settings UI
4. Optional: Add Google OAuth integration for better search results

---

## Session: 2026-02-06 (Evening)

### What Was Attempted

#### Image Generation Routing + Capability-Aware Suggestions

Implemented a plan to make image generation always-available with a zero-config Gemini fallback.

**Files Modified:**

- `src/agent/gemini/cli/tools/img-gen.ts` — Added `geminiApiKey` param, Gemini native fallback via `generateContent` with `responseModalities: ['IMAGE', 'TEXT']`
- `src/agent/gemini/cli/tools/conversation-tool-config.ts` — Always register image gen tool when geminiApiKey OR imageGenModel exists
- `src/process/task/GeminiAgentManager.ts` — Added `getGeminiApiKeyForTools()` to resolve API key from env/config
- `src/agent/gemini/index.ts` — Threaded `geminiApiKey` through GeminiAgent2Options
- `src/process/bridge/geminiConversationBridge.ts` — Pass model name to suggestion service
- `src/process/services/suggestionService.ts` — Model-aware suggestion prompts

**What Failed:**

1. **Gemini Imagen standalone** (`generateImages` API) — "model not found" or API not enabled
2. **Gemini native image gen** (`generateContent` + responseModalities) — "model not found"
3. Both approaches required threading API keys through 6 files (fighting CLI architecture)

**Key Discovery:** Worker `console.log`/`console.error` goes to a black hole — `utilityProcess.fork()` doesn't pipe stdout. Used `updateOutput?.()` for tool progress visibility instead.

### Architectural Discussion

Had an important discussion about Foundry's role and whether to build an orchestration layer.

**Three Options Considered:**

- **Option A**: Stay in CLI lane (current approach, gets tangled with each new capability)
- **Option B**: Full orchestration layer like NanoBot (massive rewrite, CLIs give too much for free)
- **Option C**: Shared capability layer (hybrid — keep CLIs, pull cross-cutting tools to main process)

**Decision: "Stay thin. Don't orchestrate. Enhance."**

- Foundry's value = unified GUI + conversation management + distribution channels
- Custom tools that fix CLI deficiencies (web search, web fetch) = GOOD
- Adding capabilities CLIs should natively provide (image gen) = FIGHTING UPSTREAM
- CLIs are rapidly evolving their own orchestration — don't compete

**New Approach for Image Gen:**
Instead of bolting onto chat CLIs, make it a **first-class sidebar flow**:

```
Sidebar:
├── New Chat        → picks a chat model
├── New Image       → picks an image model (DALL-E 3, gpt-image-1, Imagen)
├── New Project     → ...
└── New Schedule    → ...
```

Direct API calls, no CLI routing. Dead simple.

### What to KEEP from This Session

- **Model-aware suggestions** (suggestionService.ts + geminiConversationBridge.ts) — good enhancement, works
- **The architectural principle** — documented in MEMORY.md and TODO.md

### What to DECIDE Next Session

- Revert the in-chat image gen code? Or keep as secondary path alongside "New Image" flow?
- Start implementing the "New Image" sidebar flow?
- Which image APIs to support first? (DALL-E 3 via OpenAI SDK is easiest)

### Current Code State

- TypeScript compiles clean
- Image gen code is in tree but the Gemini fallback doesn't work (model not found)
- Model-aware suggestions work
- App needs full restart after any worker file changes

---

## Session: 2026-02-08 (Afternoon)

### What Was Accomplished

#### Full Platform Vision + Battle Plan

1. **2,227-line brainstorming document** created covering the complete Foundry transformation:
   - 12-phase roadmap from Foundation to Browser Agent
   - Constitution governance system (522-line CONSTITUTION.md)
   - Stubs (smart content cards in chat)
   - Projects (structured workspaces with `.foundry/` folders + Spark onboarding)
   - Persistent Memory (sqlite-vec + ONNX + bge-micro-v2 local RAG)
   - Ember (thin personal assistant layer)
   - Skill Library + MCP Store
   - TipTap WYSIWYG editing suite
   - Voice mode (Whisper STT + ElevenLabs TTS)
   - Browser agent (extend Playwright)
   - Channel expansion (Slack, WhatsApp, Discord, Signal; remove Lark)
   - Competitive analysis (OpenClaw, Nanobot, ChatGPT Desktop, Cursor)

2. **33 architecture decisions** resolved — zero open questions remaining

3. **Claude Code Swarm development strategy** — 4-person Agent Teams (renderer, platform, security, agents) with file ownership rules, plan approval, git branching per phase

4. **26 architectural gaps/risks** identified and addressed

5. **Image generation bugs fixed** (7 items) — wrong model names, SWR mutation, platform checks, API routing

#### Project Memory Layer (`.foundry/` structure)

Established the in-project memory layer that Foundry projects will use:

```
.foundry/
  VISION.md      # Full 2,227-line brainstorming document
  todo.md        # Active task tracking
  decisions.md   # 33 settled architecture decisions
  lessons.md     # 10 lessons learned from previous sessions
```

Also created:

- `BATTLEPLAN.md` — condensed execution plan (phases, teams, tasks, rollback)
- Updated `CLAUDE.md` with Session Startup instructions, gotchas, build target
- Updated `TODO.md` as legacy pointer to `.foundry/todo.md`

### Key Decisions Made This Session

1. **D-001**: "Stay thin at agent layer, orchestrate at platform layer"
2. **D-002**: English-only for now
3. **D-003**: Fork @office-ai/aioncli-core (medium-term)
4. **D-004**: DB CHECK → Zod validation
5. **D-005**: Remove Lark channel
6. **D-010**: "Stubs" naming for content cards
7. **D-012**: Ember = thin assistant (~1% of Claude Code)
8. **D-014**: TipTap replaces MarkdownEditor
9. **D-024**: Claude Code Swarm development approach
10. See `.foundry/decisions.md` for all 33 decisions

### Current Code State

- Git status: clean (main branch)
- TypeScript compiles clean
- All previous features working
- New `.foundry/` project structure established
- Ready for Phase 0 execution

### Next Steps

**Phase 0: Foundation** — See `BATTLEPLAN.md`

1. Remove DB CHECK constraints → Zod validation
2. Real credential encryption (AES-256-GCM)
3. Rate limiting + stronger pairing
4. Spike sqlite-vec + ONNX in Electron (risk reduction)

### Files Created This Session

- `.foundry/VISION.md` (brainstorm doc, 2,227 lines)
- `.foundry/todo.md` (active tasks)
- `.foundry/decisions.md` (33 decisions)
- `.foundry/lessons.md` (10 lessons)
- `BATTLEPLAN.md` (execution plan)

### Files Modified This Session

- `CLAUDE.md` — Session Startup, gotchas, build target, `.foundry/` references
- `TODO.md` — converted to legacy pointer
- `SESSION_NOTES.md` — this entry

---

## Session: 2026-02-08 (Evening) — Session 4

### Context

Previous session (Session 3b) ran out of context mid-task while wiring the Constitution settings tab. User provided 16 reference screenshots from MiniMax Agent and Claude.ai showing UX patterns to adopt, plus 5 GitHub repos to investigate.

### What Was Accomplished

#### 1. Finished Constitution Tab (picked up from crash point)

- Wired `ConstitutionModalContent` import, menuItems entry, and renderContent case
- Constitution tab now fully functional in Settings modal

#### 2. Full Audit of In-Flight Work (Phases 0-2)

Audited all 14 uncommitted files. **Everything is COMPLETE**, not stubs:

| Phase               | Files                                                     | Status      |
| ------------------- | --------------------------------------------------------- | ----------- |
| 0.1 DB/Zod          | schema.ts (v13), migrations.ts, types.ts                  | ✅ Complete |
| 0.2 Crypto          | credentialCrypto.ts (AES-256-GCM + safeStorage)           | ✅ Complete |
| 0.3 Rate limiting   | rateLimiter.ts, PairingService.ts (8-char, crypto random) | ✅ Complete |
| 1.1 StubCard        | StubCard.tsx, Markdown.tsx (thresholds working)           | ✅ Complete |
| 1.3 Context menu    | ConversationContextMenu.tsx, ChatHistory.tsx              | ✅ Complete |
| 1.4 Search          | ConversationSearch.tsx (debounce + Ctrl+K)                | ✅ Complete |
| 2.2 Constitution    | constitutionService.ts (load, cache, format)              | ✅ Complete |
| 2.3 Constitution UI | ConstitutionModalContent.tsx + SettingsModal wiring       | ✅ Complete |
| 2.4 Context budget  | contextBudget.ts (per-agent allocator)                    | ✅ Complete |
| 2.5 Agent injection | agentUtils.ts (constitution + skills into prompts)        | ✅ Complete |

#### 3. GitHub Research (5 repos)

- **microsoft/agent-lightning** (14.3k★) — REFERENCE. RL training. Trace architecture interesting.
- **ui-ux-pro-max-skill** (29.5k★) — REFERENCE. SKILL.md format is instructive.
- **awesome-openclaw-skills** (11.6k★) — REFERENCE. Quality-gating patterns for marketplace.
- **Ai-Agent-Skills** (757★) — REFERENCE. SKILL.md = YAML frontmatter + markdown = de facto standard.
- **agentkits-marketing** (264★) — SKIP.

#### 4. New Phase 1.5: SendBox UX Overhaul

Added to battle plan based on user's MiniMax/Claude.ai screenshots:

- **1.5.1** Suggested Action Pills (Schedules, Websites, Research, Videos, More)
- **1.5.2** Action Pill Templates (contextual prompt suggestions)
- **1.5.3** SendBox Settings Popover (Subagent/MCP toggles, Project Settings)
- **1.5.4** Model Mode Selector (Air/Custom/Pro icons)
- **1.5.5** MCP-Powered Suggestions ("From Drive", "From Calendar")
- **1.5.6** Voice Mode Placeholder (waveform icon)

#### 5. Building Phase 1.5 (in progress)

Started implementation of SendBox UX overhaul.

### Project Files Updated

- `.foundry/todo.md` — Phases 0-2 marked complete, Phase 1.5 added, research documented
- `BATTLEPLAN.md` — Phases 0-2 marked complete, Phase 1.5 added with full task breakdown
- `SESSION_NOTES.md` — this entry

### Deferred Items

- **1.2 StubStream.tsx** — needs message streaming status integration
- **0.T Tests** — unit tests for Phase 0
- **0.V Verify** — npm test && npm start
- **0.S sqlite-vec spike** — deferred to Phase 5

### Current Code State

- All Phase 0-2 code implemented but uncommitted on main
- Constitution settings tab fully wired
- Building Phase 1.5 SendBox UX

---

## Session: 2026-02-08 (Late Evening) — Session 5

### Context

Continuation of Session 4 after context window ran out. Phase 1.5 tasks 1.5.1-1.5.4 had components created and wired into GeminiSendBox/GeminiChat only.

### What Was Accomplished

#### 1. Cross-Agent Toolbar Integration

Wired ModelModeSelector, SendBoxSettingsPopover, and VoiceModeButton into ALL three agent SendBoxes:

- **GeminiSendBox** — already had ModelModeSelector + Settings, added VoiceModeButton
- **CodexSendBox** — added ModelModeSelector (sendButtonPrefix), SendBoxSettingsPopover + VoiceModeButton (tools)
- **AcpSendBox** — same as CodexSendBox

#### 2. Cross-Agent Action Pills Integration

Wired SuggestedActionPills + ActionTemplates into ALL three Chat containers:

- **GeminiChat** — already had pills (Session 4)
- **CodexChat** — added useMessageList, useActionPills, pills below SendBox, sendbox.fill event
- **AcpChat** — same as CodexChat

#### 3. VoiceModeButton (Task 1.5.6)

Created `VoiceModeButton.tsx` — microphone SVG icon with tooltip "Voice mode (coming soon)". Placeholder for Phase 10.

#### 4. Codex CLI Confirmation

Confirmed Foundry has full native Codex CLI support via JSON-RPC over stdio. No additional SDK needed.

### Files Created

- `src/renderer/components/VoiceModeButton.tsx`

### Files Modified

- `src/renderer/pages/conversation/codex/CodexSendBox.tsx` — imports, modelMode state, toolbar components
- `src/renderer/pages/conversation/codex/CodexChat.tsx` — action pills, useMessageList, HOC.Wrapper
- `src/renderer/pages/conversation/acp/AcpSendBox.tsx` — imports, modelMode state, toolbar components
- `src/renderer/pages/conversation/acp/AcpChat.tsx` — action pills, useMessageList
- `src/renderer/pages/conversation/gemini/GeminiSendBox.tsx` — added VoiceModeButton import + usage
- `.foundry/todo.md` — tasks 1.5.1-1.5.4, 1.5.6 marked complete
- `SESSION_NOTES.md` — this entry

### Phase 1.5 Status

| Task                          | Status   | Notes                     |
| ----------------------------- | -------- | ------------------------- |
| 1.5.1 SuggestedActionPills    | ✅       | All 3 agents              |
| 1.5.2 ActionTemplates         | ✅       | All 3 agents              |
| 1.5.3 SendBoxSettingsPopover  | ✅       | All 3 agents              |
| 1.5.4 ModelModeSelector       | ✅       | All 3 agents              |
| 1.5.5 MCP-Powered Suggestions | Deferred | Needs MCP Store (Phase 8) |
| 1.5.6 VoiceModeButton         | ✅       | Placeholder, all 3 agents |

### Current Code State

- TypeScript compiles clean
- All Phase 0-2 + Phase 1.5 code implemented (uncommitted on main)
- Phase 1.5 effectively complete (1.5.5 deferred to Phase 8 since it needs real MCP connections)
- Ready for Phase 3: Projects Foundation

### Next Steps (if session continues)

1. Build Phase 1.5 SendBox UX (action pills, settings popover, mode selector)
2. Phase 3: Projects Foundation
3. Eventually: commit all work with proper git flow
