# Foundry — Battle Plan

> Condensed execution reference. Full vision: `.foundry/VISION.md`
> Task tracking: `.foundry/todo.md` | Decisions: `.foundry/decisions.md` | Lessons: `.foundry/lessons.md`

---

## Execution Strategy

- **Mode:** Supervised autonomous — Claude Code Agent Teams
- **Branching:** `foundry/phase-N-name` per phase. Rollback = `git checkout` to previous branch.
- **Testing:** Every phase verified before moving to next. Testing agent alongside feature agents.
- **Pre-flight:** `git checkout -b foundry/phase-N` → `npm start` → `npm test`

---

## Team Structure (4 Teammates)

| Teammate     | Focus               | Owns                                  | Never Touches                       |
| ------------ | ------------------- | ------------------------------------- | ----------------------------------- |
| **renderer** | Frontend            | `src/renderer/**`                     | `src/process/**`, `src/channels/**` |
| **platform** | Backend             | `src/process/**`, `src/common/**`     | `src/renderer/**`                   |
| **security** | Security + channels | `src/channels/**`, `src/webserver/**` | `src/renderer/**`                   |
| **agents**   | Agent + tools       | `src/agent/**`, `src/worker/**`       | `src/renderer/**`                   |

**Shared files** (`src/common/types`, `package.json`, DB schema) → lead only.

---

## Phase 0: Foundation — DB + Security Hardening ✅ COMPLETE

**Status:** All tasks implemented (Session 4 audit confirmed)

| Task | Status | What                                                                                         |
| ---- | ------ | -------------------------------------------------------------------------------------------- |
| 0.1  | ✅     | DB CHECK constraints removed → Zod validation (`schema.ts` v13, `migrations.ts`, `types.ts`) |
| 0.2  | ✅     | AES-256-GCM via `safeStorage` with Base64 migration fallback (`credentialCrypto.ts`)         |
| 0.3  | ✅     | Rate limiting (`rateLimiter.ts`) + 8-char alphanumeric pairing (`PairingService.ts`)         |
| 0.4  | ✅     | Debug console.log cleaned                                                                    |

**Deferred:** Tests + verification pending. sqlite-vec spike deferred to Phase 5.

---

## Phase 1: Stubs + UX Polish ✅ COMPLETE (except 1.2)

**Status:** Core tasks done, StubStream deferred

| Task | Status      | What                                                                                 |
| ---- | ----------- | ------------------------------------------------------------------------------------ |
| 1.1  | ✅          | **StubCard.tsx** + code block thresholds in **Markdown.tsx** (<20/20-50/50+)         |
| 1.2  | ⏳ Deferred | **StubStream.tsx** — needs message streaming status integration                      |
| 1.3  | ✅          | **ConversationContextMenu.tsx** — three-dot dropdown, wired into **ChatHistory.tsx** |
| 1.4  | ✅          | **ConversationSearch.tsx** — sidebar search with debounce + Ctrl+K                   |

---

## Phase 1.5: SendBox UX Overhaul ✅ COMPLETE

**Status:** All tasks implemented across Gemini, Codex, and ACP agents (Session 5)

| Task  | Status      | What                                                                                                                                          |
| ----- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.5.1 | ✅          | **SuggestedActionPills.tsx** — 6 categories (Schedules, Research, Writing, Code, Websites, Images). Wired into GeminiChat, CodexChat, AcpChat |
| 1.5.2 | ✅          | **ActionTemplates** — 5 templates per category. Click → `sendbox.fill` event → fills input                                                    |
| 1.5.3 | ✅          | **SendBoxSettingsPopover.tsx** — gear icon, nested Subagent/MCP/Settings menus. All 3 SendBoxes                                               |
| 1.5.4 | ✅          | **ModelModeSelector.tsx** — Air/Custom/Pro icons with tooltips. All 3 SendBoxes                                                               |
| 1.5.5 | ⏳ Deferred | **MCP-Powered Suggestions** — needs real MCP connections (Phase 8)                                                                            |
| 1.5.6 | ✅          | **VoiceModeButton.tsx** — microphone icon placeholder. All 3 SendBoxes                                                                        |

---

## Phase 2: Constitution Integration ✅ COMPLETE

**Status:** All tasks implemented (Session 4 audit confirmed)

| Task | Status | What                                                                                               |
| ---- | ------ | -------------------------------------------------------------------------------------------------- |
| 2.2  | ✅     | **constitutionService.ts** — load, parse, cache. Used by `agentUtils.ts` for prompt injection      |
| 2.3  | ✅     | **ConstitutionModalContent.tsx** — read-only viewer + "Human-only" badge. Wired into SettingsModal |
| 2.4  | ✅     | **contextBudget.ts** — token budget allocator per agent type. Used by `agentUtils.ts`              |
| 2.5  | ✅     | **agentUtils.ts** — constitution + skills injection into agent system prompts                      |

---

## Phase 3: Projects Foundation ✅ COMPLETE

**Status:** All tasks implemented (Session 5)

| Task | Status | What                                                                                                                                                                                        |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1  | ✅     | **projectService.ts** — detect, init, read, list, archive, delete + loadInstructions/loadSkills. **projectBridge.ts** IPC + `ipcBridge.project.*` channels                                  |
| 3.2  | ✅     | Project context loading — `.foundry/instructions.md` + `skills/*.md` injected into ALL agents via `agentUtils.ts` (both `buildSystemInstructions` and `prepareFirstMessageWithSkillsIndex`) |
| 3.3  | ✅     | **ProjectCard.tsx** (type badge, metadata, menu). **ProjectWizard.tsx** (4-step modal). Sidebar "New Project" button. Guid page ProjectCards grid                                           |
| 3.4  | ✅     | "Promote to Project" in ConversationContextMenu (project detection via IPC, workspace filter)                                                                                               |
| 3.5  | ✅     | Multi-chat: `project.getConversations` IPC, workspace-based filtering                                                                                                                       |

**Deferred:** Tests, project templates (Phase 4+)

---

## Phase 4: Resilience + Error Recovery ✅ COMPLETE

**Status:** All tasks implemented (Session 5)

| Task | Status | What                                                                                                                                                                                                                                                                         |
| ---- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1  | ✅     | **gracefulDegradation.ts** — `tryWithFallback()`, `tryWithFallbackAsync()`, service health registry, `reportDegraded()`, `reportHealthy()`, pub/sub via `onDegradationChange()`. **DegradationBanner.tsx** — auto-show/dismiss, yellow/red severity, wired into `layout.tsx` |

---

## Phase 5: Persistent Memory ✅ COMPLETE

**Status:** All core tasks implemented (Session 6). FTS5/BM25 search live. sqlite-vec/ONNX deferred.

| Task | Status | What                                                                 |
| ---- | ------ | -------------------------------------------------------------------- |
| 5.1  | ✅     | DB migration v14 — `memory_chunks` + FTS5 + `user_profile`           |
| 5.2  | ✅     | `memoryService.ts` — chunk, sanitize, FTS5/BM25 search, user profile |
| 5.3  | ✅     | `sessionSummaryService.ts` — Gemini Flash memory extraction          |
| 5.4  | ✅     | `memoryBridge.ts` — full IPC bridge                                  |
| 5.5  | ✅     | Agent injection via `agentUtils.ts` (15% context budget)             |
| 5.6  | ✅     | Session extraction triggers in all 3 SendBoxes                       |
| 5.7  | ✅     | Memory Settings UI in SettingsModal                                  |
| 5.S  | ⏳     | sqlite-vec + ONNX spike deferred                                     |

---

## Phase 6: Editing Suite ✅ COMPLETE

**Status:** Core TipTap editor created (Session 7). Full MarkdownEditor replacement deferred.

| Task | Status | What                                                                                                                                         |
| ---- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1  | ✅     | `FoundryDocEditor.tsx` — TipTap WYSIWYG with toolbar (headings, bold/italic/strike, lists, blockquote, code). Exported from editors/index.ts |
| 6.2  | ⏳     | Wire into PreviewPanel as MarkdownEditor replacement (deferred — needs scroll sync adapter)                                                  |

---

## Phase 7: Skill Store ✅ COMPLETE

**Status:** Core UI + security audit created (Session 7).

| Task | Status | What                                                                                                                                        |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1  | ✅     | `skillSecurityAudit.ts` — 12 audit rules (prompt injection, shell invocation, credential exfil, obfuscation). Returns pass/warn/danger      |
| 7.2  | ✅     | `SkillStoreModalContent.tsx` — 20 curated skills across 7 categories. Search/filter/browse. Import from directory. Wired into SettingsModal |
| 7.3  | ⏳     | "Generate a Skill" flow (deferred — needs AI generation pipeline)                                                                           |

---

## Phase 8: MCP Store ✅ COMPLETE

**Status:** Core UI + registry created (Session 7).

| Task | Status | What                                                                                                                                |
| ---- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 8.1  | ✅     | `mcpStoreService.ts` — 24 curated MCP servers (Anthropic official + community). Search/category API                                 |
| 8.2  | ✅     | `McpStoreModalContent.tsx` — Browse/search/install UI. One-click install to ConfigStorage. Category pills. Wired into SettingsModal |
| 8.3  | ⏳     | Per-project `.foundry/mcp.json` config (deferred — needs project context integration)                                               |

---

## Phase 9: Ember Core ✅ COMPLETE

**Status:** All tasks implemented (Session 8). Backend service + UI + settings.

| Task | Status | What                                                                                                                                                   |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 9A.1 | ✅     | `emberService.ts` — Intent classification (pattern matching + LLM fallback), Gemini Flash brain, conversation history, memory enrichment, activity log |
| 9A.2 | ✅     | `emberPersonality.ts` — 5 personalities (bubbly/professional/casual/minimal/custom), 3 autonomy levels, system prompt builder                          |
| 9A.3 | ✅     | `emberBridge.ts` — IPC bridge (send, getActivity, getConfig, setConfig, resetConversation)                                                             |
| 9B.1 | ✅     | `EmberChat.tsx` — Lightweight chat with local state, message bubbles, empty state introduction                                                         |
| 9B.2 | ✅     | `EmberSendBox.tsx` — Minimal input (textarea + send, no file/model/tools)                                                                              |
| 9B.3 | ✅     | `EmberModalContent.tsx` — Settings: personality selector, autonomy, custom prompt, activity feed                                                       |
| 9B.4 | ✅     | Conversation type integration — storage.ts, ChatConversation.tsx, SettingsModal, draft store                                                           |

**Security audit applied:** Input length validation (10K chars), prompt injection defense noted.

---

## Phase 10: Voice Mode ✅ COMPLETE

**Status:** All core tasks implemented (Session 8). STT + TTS + recorder UI.

| Task | Status | What                                                                                                         |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------ |
| 10.1 | ✅     | `voiceService.ts` — Whisper STT (multipart upload), OpenAI TTS (tts-1), temp file management, 1-hour cleanup |
| 10.2 | ✅     | `voiceBridge.ts` — IPC bridge (transcribe, synthesize, saveRecording, getConfig, setConfig)                  |
| 10.3 | ✅     | `VoiceModeButton.tsx` — MediaRecorder capture, 3-state UI (idle/recording/transcribing), duration timer      |
| 10.4 | ✅     | IPC types in ipcBridge.ts — IVoiceConfig, ITranscriptionResult, ISpeechResult                                |

**Security audit applied:** Path traversal prevention (assertSafePath), audio format whitelist.

---

## Phase 11: Channels ✅ COMPLETE

**Status:** All 4 adapters implemented (Session 8). Registered in ChannelManager.

| Task | Status | What                                                                                                |
| ---- | ------ | --------------------------------------------------------------------------------------------------- |
| 11.1 | ✅     | `WhatsAppPlugin.ts` + `WhatsAppAdapter.ts` — Baileys SDK, QR pairing, reconnect with backoff        |
| 11.2 | ✅     | `DiscordPlugin.ts` + `DiscordAdapter.ts` — discord.js, Gateway WebSocket, interactions              |
| 11.3 | ✅     | `SlackPlugin.ts` + `SlackAdapter.ts` — @slack/bolt, Socket Mode, Block Kit actions                  |
| 11.4 | ✅     | `SignalPlugin.ts` + `SignalAdapter.ts` — signal-cli-rest-api, WebSocket + REST, exponential backoff |
| 11.5 | ✅     | `ChannelManager.ts` — All 4 plugins registered                                                      |
| 11.6 | ✅     | `types.ts` — Extended PluginType union with 'whatsapp' and 'signal'                                 |

**Security audit applied:** SSRF prevention on Signal URL, WhatsApp auth path hardened, reconnect loop guarded.

---

## Phases Remaining

| Phase  | Name          | Team | Key Deliverables                                                                         |
| ------ | ------------- | ---- | ---------------------------------------------------------------------------------------- |
| **12** | Browser Agent | 2    | Tool interfaces (navigate/click/fill/screenshot), extend Playwright, screenshot feedback |

---

## Swarm Coordination Rules

1. Never edit files outside your ownership boundary
2. Shared files (`package.json`, `src/common/types/`, DB schema) → lead only
3. Run `npm test` after every phase
4. Report blockers immediately via mailbox
5. Git branch per phase — never commit directly to main
6. Plan approval before implementation (teammates submit plans, lead reviews)
7. Define TypeScript interfaces first for cross-boundary contracts

---

## Custom Subagent Files (`.claude/agents/`)

| File                  | Role                | Model  | Tools                               |
| --------------------- | ------------------- | ------ | ----------------------------------- |
| `foundry-renderer.md` | Frontend specialist | opus   | Read, Write, Edit, Glob, Grep, Bash |
| `foundry-platform.md` | Backend specialist  | opus   | Read, Write, Edit, Glob, Grep, Bash |
| `foundry-security.md` | Security + channels | opus   | Read, Write, Edit, Glob, Grep, Bash |
| `foundry-agents.md`   | Agent + tools       | opus   | Read, Write, Edit, Glob, Grep, Bash |
| `foundry-tester.md`   | Testing QA          | sonnet | Read, Write, Edit, Glob, Grep, Bash |
| `foundry-reviewer.md` | Code review         | sonnet | Read, Grep, Glob (read-only)        |

---

## Rollback Strategy

```
# Per-phase branches
git checkout -b foundry/phase-0-foundation
# ... work ...
git add -A && git commit -m "feat: Phase 0 complete"
git checkout -b foundry/phase-1-stubs-ux

# If phase fails
git checkout foundry/phase-N-1  # back to last good
git branch -D foundry/phase-N   # delete failed

# Nuclear
git checkout main
```

---

## Key Architectural Decisions

1. **"Stay thin at agent layer, orchestrate at platform layer"**
2. **English-only** until later (remove unused locale files)
3. **Fork @office-ai/aioncli-core** for trust/transparency (medium-term)
4. **DB CHECK → Zod** — one migration, permanent fix
5. **Memory: 512-token chunks, hybrid 70/30 vector/BM25, cap at 15% context budget**
6. **Ember = thin assistant**, not multi-agent framework
7. **TipTap replaces MarkdownEditor**, CodeMirror/Monaco stay
8. **Remove Lark**, add Slack/WhatsApp/Discord/Signal
9. **All channels = Ember**
10. **Constitution enforcement is deep** — every CLI agent respects it

---

## Critical Gotchas

- **Workers don't hot-reload** — `utilityProcess.fork()` snapshots at fork time. Full app restart for worker changes.
- **Worker console.log is a black hole** — use `updateOutput?.()` instead
- **ONNX + sqlite-vec native modules** — must spike in Electron on all 3 platforms before committing to Phase 5
- **Credential encryption on Linux headless** — `safeStorage` needs `app.isReady()`, true daemon needs workaround
- **Skill injection is deeper than pattern matching** — acknowledged unsolved, not just "ignore previous instructions"
- **SWR cache mutation** — always clone provider objects before modifying
- **finishBridgeRef** — useEffect deps must NOT include callbacks or indicator sticks forever
