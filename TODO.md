# Foundry - TODO

## Current Priority: Fix Web Tools (Next Session)

### WebFetch / GoogleSearch Not Working

**Problem**: Both tools fail in Gemini CLI. AI falls back to shell (curl).

**Files to investigate:**

- `src/agent/gemini/cli/tools/web-fetch.ts` - Has retry logic, User-Agent rotation
- `src/agent/gemini/cli/tools/web-search.ts` - Uses Gemini grounding API

**Options:**

1. Check Gemini API grounding feature access (billing/plan)
2. Use a web scraping API service
3. Implement headless browser (Puppeteer)
4. Accept shell/curl as fallback (works but verbose)

**Test command:**

```bash
node -e "fetch('https://site.com').then(r=>console.log(r.status))"
```

---

## Completed (2026-02-06)

### UX Polish - All P2 Items Done

- [x] User/AI message visual distinction (`MessageAvatar.tsx`, `MessagetText.tsx`)
- [x] File preview peeking on hover (`FilePreviewTooltip.tsx`)
- [x] Micro-interaction animations (CSS classes applied)
- [x] Confidence badges on web search (`ConfidenceBadge.tsx`)
- [x] Clean Slate color scheme (neutral grays + orange accents)
- [x] Sidebar width: 250px → 290px (`layout.tsx`)
- [x] MessageList footer height fix (thinking indicator visibility)

### Previous Sessions

- [x] Remove Chinese comments (4,315 → ~5 intentional strings)
- [x] Compact tool summaries (collapsed by default)
- [x] Context-aware progress messages (Foundry phrases)
- [x] Per-operation progress indicators
- [x] Skeleton loading states
- [x] Keyboard shortcuts (press `?`)
- [x] Permission dialog improvements
- [x] Graceful error recovery with retry

---

## Remaining

### P2 - Image Generation (First-Class Flow)

- [ ] "New Image" sidebar option (alongside New Chat, New Project, New Schedule)
- [ ] Image model selector (DALL-E 3, gpt-image-1, Imagen 4, OpenRouter)
- [ ] Direct API calls — no CLI routing, no tool system
- [ ] New conversation type (`image`) alongside gemini/codex/acp
- [ ] Prompt input + reference image attachment + image display
- [ ] Decision: revert or keep the in-chat Gemini fallback code?

### P3 - Future

- [ ] Artifact panel (like Claude.ai) - deferred
- [ ] Session continuity (remember last conversation)
- [ ] Local model auto-detection service
- [ ] Resource monitoring for local inference

### Technical Debt

- [ ] Review `@office-ai/*` upstream dependencies
- [ ] Update Homebrew formula for Foundry distribution
- [ ] Fix node-pty native module build on Windows
- [ ] Address npm security vulnerabilities

---

## Key Files Changed This Session

| File                                                   | Change                   |
| ------------------------------------------------------ | ------------------------ |
| `src/renderer/layout.tsx:53`                           | Sidebar width 250 → 290  |
| `src/renderer/styles/themes/color-schemes/default.css` | Clean Slate theme        |
| `src/renderer/components/MessageAvatar.tsx`            | NEW - User/AI avatars    |
| `src/renderer/components/FilePreviewTooltip.tsx`       | NEW - Hover preview      |
| `src/renderer/components/ConfidenceBadge.tsx`          | NEW - Source count badge |
| `src/renderer/messages/MessagetText.tsx`               | Avatar + bubble layout   |
| `src/renderer/messages/MessageList.tsx`                | Footer height fix        |
| `src/agent/gemini/cli/tools/web-fetch.ts`              | Retry logic + headers    |
