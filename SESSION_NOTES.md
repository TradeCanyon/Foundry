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
