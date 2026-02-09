# Foundry — Full Product Audit

> Date: 2026-02-09 | Auditor: Claude Code (Session 10)
> Method: Traced every feature from the USER's perspective — "can I actually do this?"

---

## Verdict: ~60% Ship-Ready

Foundry has strong backend services across 12 phases, but roughly 40% of features are
either unreachable from the UI, placeholders with no backend wiring, or missing the
"last mile" connection that makes them usable. The core chat experience (Gemini/ACP)
works well. Everything else has gaps.

---

## 1. FULLY WORKING (User Can Access & Get Value)

### Core Chat Experience

| Feature                | How to Access                              | Status                                                         |
| ---------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| Gemini chat            | Sidebar "+" → type message                 | **Works**                                                      |
| ACP/Claude chat        | Sidebar "+" → select Claude agent          | **Works**                                                      |
| Codex chat             | Sidebar "+" → select Codex agent           | **Works** (if CLI detected)                                    |
| File attachments       | Drag/drop, paste, or "+" button in sendbox | **Works** — all 3 agents                                       |
| Voice input            | Mic button in sendbox                      | **Works** — recording → Whisper STT → fills sendbox            |
| Suggested action pills | Empty conversation → category pills        | **Works** — 6 categories, templates fill sendbox               |
| Suggested replies      | After AI response → placeholder text       | **Works** — Gemini only, auto-generated                        |
| Conversation search    | Ctrl+K or search box in sidebar            | **Works** — client-side filtering                              |
| Context menu           | Three-dot on conversation                  | **Works** — rename, export MD/JSON, delete, promote to project |
| Thinking indicator     | During AI generation                       | **Works** — Foundry-themed phrases, pulsing animation          |

### Tools (Gemini Agent)

| Feature                 | How to Access               | Status                                                                          |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| Web fetch               | AI decides to fetch a URL   | **Works** — 3-tier: Playwright → Jina → direct                                  |
| Web search              | AI decides to search        | **Works** — Jina → DuckDuckGo fallback                                          |
| Browser agent (6 tools) | Ask AI to browse/click/fill | **Works** — but screenshot was too large (JPEG fix applied, needs restart test) |
| Tool summaries          | Collapsed badge in message  | **Works** — Read/Write/Shell/Search/Web/Browser/MCP/Other categories            |
| Tool confirmations      | Click/fill browser tools    | **Works** — confirmation dialog before mutations                                |

### Settings (All Load & Save Correctly)

| Tab              | How to Access              | Status                                                         |
| ---------------- | -------------------------- | -------------------------------------------------------------- |
| Gemini           | Settings → Gemini          | **Works** — API key, Google OAuth, proxy, YOLO mode            |
| Models           | Settings → Models          | **Works** — add/edit/delete providers                          |
| Assistants       | Settings → Assistants      | **Works** — create custom agent presets                        |
| Tools            | Settings → Tools           | **Works** — MCP server management, Claude YOLO toggle          |
| Constitution     | Settings → Constitution    | **Works** — read-only viewer with "Human-Only" badge           |
| Memory           | Settings → Memory          | **Works** — stats, search, profile viewer, delete              |
| Ember            | Settings → Ember           | **Works** — personality, autonomy, activity feed               |
| Skills           | Settings → Skills          | **Works** — 20 curated skills, search, import                  |
| MCP Store        | Settings → MCP Store       | **Works** — 24 curated servers, one-click install              |
| Voice            | Settings → Voice           | **Works** — STT/TTS provider, voice, auto-send toggle          |
| WebUI + Channels | Settings → WebUI (desktop) | **Works** — server toggle, password, QR login, Telegram config |
| System           | Settings → System          | **Works** — cache/work directory                               |
| About            | Settings → About           | **Works** — version, update check, links                       |

### Projects

| Feature                   | How to Access                                   | Status                            |
| ------------------------- | ----------------------------------------------- | --------------------------------- |
| Create project            | Sidebar → Projects tab → "New Project"          | **Works** — 4-step wizard         |
| List projects             | Sidebar → Projects tab                          | **Works** — type badges, metadata |
| Promote conversation      | Context menu → "Promote to Project"             | **Works**                         |
| Project context injection | Automatic (`.foundry/instructions.md` + skills) | **Works** — all agents            |

### Other

| Feature                | How to Access                     | Status                                              |
| ---------------------- | --------------------------------- | --------------------------------------------------- |
| Degradation banner     | Auto-shows when service degrades  | **Works** — yellow/red severity                     |
| Markdown rendering     | AI responses                      | **Works** — GFM, KaTeX, syntax highlighting, tables |
| Code blocks            | AI responses with code            | **Works** — StubCard for 50+ lines, copy button     |
| WYSIWYG editor         | Preview panel → "Edit" tab        | **Works** — TipTap, toolbar, markdown round-trip    |
| Memory extraction      | Automatic after conversation ends | **Works** — silent background trigger, all 3 agents |
| Constitution injection | Automatic in agent system prompts | **Works** — all agents respect it                   |
| Memory injection       | Automatic (15% context budget)    | **Works** — FTS5 search + user profile              |

---

## 2. UNREACHABLE (Backend Exists, No UI Entry Point)

### Ember Assistant — **CRITICAL GAP**

- **What exists**: Full service (intent classification, Gemini Flash brain, 5 personalities,
  3 autonomy levels), IPC bridge, EmberChat.tsx, EmberSendBox.tsx, settings tab
- **What's missing**: **No way to create an Ember conversation from the UI**
  - No "New Ember" button in sidebar
  - No Ember option in the agent selector on the welcome page
  - `handleSend()` in guid/index.tsx has no `type: 'ember'` case
  - ChatConversation.tsx correctly routes `type: 'ember'` to EmberChat — but nothing creates it
- **Fix needed**: Add Ember as a conversation creation option (sidebar button or agent selector)

### Image Generation — **SHELVED (By Design)**

- **What exists**: ImageChat.tsx, ImageResult.tsx, ImageSendBox.tsx, imageGenerationService.ts
  (supports DALL-E 3, gpt-image-1, Imagen 4, OpenRouter)
- **What's missing**: Commented out in router.tsx, no UI entry point
- **Decision**: "Image gen is NOT a chat tool — it's a first-class flow" (D-028)
- **Fix needed**: Implement "New Image" sidebar option with direct API calls (not chat-based)

---

## 3. PLACEHOLDER / STUB UI (Looks Real, Does Nothing)

### SendBox Settings Popover — **FAKE**

- **What it shows**: Gear icon → Subagent toggles, MCP toggles, "Manage" buttons
- **What actually happens**: Nothing. All callbacks (`onSubagentToggle`, `onMcpToggle`,
  `onManageSubagents`, `onManageMcps`) are optional and never wired.
  Subagents are hardcoded arrays. MCPs are empty arrays. Toggles don't persist.
- **Severity**: HIGH — users will click this expecting functionality
- **Fix needed**: Either wire to real subagent/MCP management OR remove until real

### Model Mode Selector — **FAKE**

- **What it shows**: Lightning/Gear/People icons (Air/Custom/Pro modes)
- **What actually happens**: State updates locally but is never read by any backend logic.
  Mode selection has zero effect on model routing, tool selection, or behavior.
- **Severity**: MEDIUM — users will toggle expecting different behavior
- **Fix needed**: Either implement mode routing OR remove until real

---

## 4. NOT IMPLEMENTED (Never Built)

### @Mentions — **MISSING**

- **User expectation**: Type `@Ember`, `@Projects`, `@Schedule` in sendbox to invoke features
- **Reality**: No @mention system exists anywhere in the sendbox code
- **Note**: The welcome page (guid) has agent selector buttons, but no inline @mention syntax
- **Fix needed**: Build @mention autocomplete in sendbox

### Slash Commands — **MISSING**

- **User expectation**: Type `/new`, `/ember`, `/image`, `/help` for quick actions
- **Reality**: No slash command system exists in the sendbox
- **Fix needed**: Build command palette triggered by `/` prefix

### File Download Presentation — **MISSING**

- **User expectation**: When AI generates a file, show "Download this file" like Claude does
- **Reality**: FilePreview.tsx shows file metadata but no download button for generated files.
  Files attached TO messages render correctly. Files generated BY the AI don't have
  a clear download affordance.
- **Fix needed**: Add download button to generated file results in message rendering

---

## 5. BROKEN / REGRESSED

### @Mentions (Previously Working)

- **User report**: "@projects @ember @schedule @spark" and `/` commands used to work
- **Finding**: No trace of @mention code in current codebase. Either:
  (a) It was removed during the AionUI → Foundry rebrand
  (b) It was in an upstream package that was replaced
  (c) It existed in a branch that was never merged
- **Action**: Investigate git history for mention/command code

### Browser Agent Screenshots — **FIXED (Needs Verification)**

- **Issue**: 1920x1080 PNG screenshot sent as base64 exceeded 400K tokens, crashed context
- **Fix applied**: Viewport reduced to 1024x768, format changed to JPEG at 50% quality
- **Status**: Fix deployed, needs testing on fresh restart

---

## 6. CHANNEL ADAPTERS — STATUS

| Channel  | Backend       | Config UI           | Enable/Disable | Status           |
| -------- | ------------- | ------------------- | -------------- | ---------------- |
| Telegram | **Complete**  | **Complete**        | **Works**      | Production-ready |
| Slack    | Plugin exists | "Coming soon" label | No toggle      | **Stub**         |
| Discord  | Plugin exists | "Coming soon" label | No toggle      | **Stub**         |
| WhatsApp | Plugin exists | No config form      | No toggle      | **Stub**         |
| Signal   | Plugin exists | No config form      | No toggle      | **Stub**         |

**Note**: All 5 backends have message handling, reconnection, and adapter code.
Only Telegram has a config UI that lets users actually set it up.

---

## 7. CODEX AGENT — **EMPTY WORKER**

- `src/worker/codex.ts` is an empty placeholder (no agent instantiation)
- Codex conversations can be created from the UI (agent selector shows it if CLI detected)
- But the worker process that would handle messages is not implemented
- **Unclear**: Does Codex work through a different mechanism? Needs investigation.

---

## 8. PRIORITY ACTION ITEMS

### P0 — Must Fix (Broken / Misleading)

1. **Remove or wire SendBox Settings Popover** — users click it expecting real controls
2. **Remove or wire Model Mode Selector** — users toggle expecting different behavior
3. **Add Ember conversation creation** — backend is 100% done, just needs a button
4. **Investigate @mention regression** — user says it used to work
5. **Verify browser agent screenshot fix** — JPEG compression applied, needs test

### P1 — Should Fix (Major Gaps)

6. **Channel config forms for Slack/Discord/WhatsApp/Signal** — backends exist, no UI
7. **File download button on AI-generated files** — missing affordance
8. **Image generation "New Image" flow** — first-class sidebar option
9. **Wire StubStream into message rendering** — component exists, not connected

### P2 — Nice to Have (New Features)

10. **@mention autocomplete** — `@Ember`, `@Project:name`, etc.
11. **Slash command palette** — `/new`, `/ember`, `/image`, `/help`
12. **Suggested replies for ACP/Codex** — currently Gemini-only
13. **Per-channel model selection** — currently global only
14. **Memory manual extraction trigger** — currently auto-only

---

## 9. ARCHITECTURAL OBSERVATIONS

### Pattern: "Build Service, Defer Wiring"

Every phase followed the same pattern:

1. Build the service (e.g., `emberService.ts`) ✓
2. Build the IPC bridge (e.g., `emberBridge.ts`) ✓
3. Build the settings UI (e.g., `EmberModalContent.tsx`) ✓
4. **Skip the user entry point** (no "New Ember" button) ✗

This happened with Ember, Image Gen, Voice (partially), and Channel adapters.
The last 10% of wiring is what makes features usable, and it was systematically skipped.

### Pattern: "Placeholder UI Ships as Real"

SendBoxSettingsPopover and ModelModeSelector look production-ready but do nothing.
Users will discover this immediately and lose trust. These should either be
completed or removed — a beautiful button that does nothing is worse than no button.

### Pattern: "Settings Tab ≠ Feature Access"

Having an Ember settings tab in the Settings modal doesn't mean users can use Ember.
Settings configure a feature; they don't provide access to it. Both are needed.

---

## 10. VERIFICATION CHECKLIST

Before shipping, verify each feature by performing these user actions:

- [ ] Open app → create new Gemini chat → send message → get response
- [ ] Attach a file → verify it appears in message → verify AI processes it
- [ ] Ctrl+K → search conversations → click result → opens correctly
- [ ] Right-click conversation → rename → verify rename persists
- [ ] Right-click conversation → export markdown → verify file downloads
- [ ] Right-click conversation → delete → verify removed
- [ ] Settings → each tab → change a setting → close → reopen → verify persisted
- [ ] Ask AI to browse a website → verify Browser tool fires → verify no context overflow
- [ ] Ask AI to search the web → verify results appear
- [ ] Create a project → verify it appears in sidebar → start a chat in it
- [ ] Voice button → record → verify transcription fills sendbox
- [ ] Settings → WebUI → enable → verify Telegram config visible
- [ ] (After fixes) Create Ember conversation → send message → get personality-aware response
- [ ] (After fixes) @mention in sendbox → verify autocomplete
- [ ] (After fixes) /command in sendbox → verify command palette

---

_This audit should be read at the start of every future session._
_Update it as items are fixed. Don't mark anything done until verified by user._
