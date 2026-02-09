# Foundry - TODO

> **This file is a legacy pointer.** Active task tracking has moved to the `.foundry/` project structure.

## Active Task Tracking

| File                        | Purpose                                        |
| --------------------------- | ---------------------------------------------- |
| **`.foundry/todo.md`**      | Current tasks with checkboxes — **START HERE** |
| **`.foundry/decisions.md`** | 33 settled architecture decisions              |
| **`.foundry/lessons.md`**   | Mistakes + patterns to prevent recurrence      |
| **`BATTLEPLAN.md`**         | Condensed 12-phase execution plan              |
| **`.foundry/VISION.md`**    | Full 2,227-line brainstorming document         |

## Current Target

**Phase 0: Foundation** — DB migration (CHECK → Zod) + Security hardening (AES-256-GCM credentials, rate limiting, stronger pairing).

See `.foundry/todo.md` for the full task breakdown.

---

## Completed (Previous Sessions)

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
- [x] UX polish (avatars, file preview, confidence badges, shortcuts)
- [x] Image generation backend complete (shelved from UI)
- [x] Channels Phase 1 (Telegram + Lark)
- [x] Image gen bug fixes (7 items, 2026-02-08)
