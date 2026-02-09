# Foundry — Lessons Learned

> After ANY correction or discovery, add an entry. Review at session start.

---

## 2026-02-09 — DB column names: always verify against actual schema

**Trigger:** `searchConversations` query used `modify_time`/`create_time` which don't exist — actual columns are `updated_at`/`created_at`. Crashed Ctrl+K search with `SqliteError`.
**Pattern:** When writing SQL queries, verify column names against the actual migration/schema. Don't assume naming conventions — check `rowToConversation()` or the migration file.

## 2026-02-09 — IPC types are the source of truth for renderer code

**Trigger:** Used `voice.synthesize.invoke({ text, voice })` but IPC type only accepts `{ text: string }`. Used `result.filePath` but type has `audioPath`. Used `ipcBridge.fs.copyFile` and `removeSkill` which don't exist.
**Pattern:** Always check `ipcBridge.ts` for exact IPC signatures before using them in renderer code. The IPC bridge types define exactly what parameters are accepted and what's returned.

## 2026-02-08 — Worker hot-reload doesn't exist

**Trigger:** Code changes in `web-fetch.ts` and `web-search.ts` had no effect until full app restart.
**Pattern:** Worker processes (`gemini.ts`, `codex.ts`, `acp.ts`) are forked via `utilityProcess.fork()` and run from an in-memory snapshot at fork time. Code changes in worker-executed files require FULL APP RESTART. Renderer changes hot-reload fine.

## 2026-02-08 — Worker console.log goes to black hole

**Trigger:** Debugging web-fetch.ts with console.log produced no output.
**Pattern:** `utilityProcess.fork()` does NOT pipe worker stdout to main process. Use `updateOutput?.()` for tool progress visibility. Never rely on console.log in worker code.

## 2026-02-08 — SWR cache mutation breaks everything

**Trigger:** `platform.model = ...` in `useConfigModelListWithImage.ts` mutated cached SWR objects, causing stale state across the app.
**Pattern:** ALWAYS clone objects before modifying them when they come from SWR cache. Use spread operator: `const clone = { ...original }`.

## 2026-02-08 — Wrong Gemini image model names

**Trigger:** Used `gemini-2.5-flash-image-preview` then `gemini-2.5-flash-preview-image-generation` (both invalid, return 500). Correct: `gemini-2.5-flash-image`.
**Pattern:** Always verify model names against official API docs. Model naming conventions are inconsistent across providers. Google's image gen model naming differs from their chat models.

## 2026-02-08 — OpenAI image models need Images API, not chat completions

**Trigger:** `generateWithProvider` routed dall-e-3 and gpt-image-1 through chat completions endpoint.
**Pattern:** OpenAI image models use `client.images.generate()`, NOT `client.chat.completions.create()`. Detect by model name and route accordingly.

## 2026-02-08 — finishBridgeRef useEffect dependency trap

**Trigger:** Including callbacks in useEffect dependency array caused re-subscription, which cancelled the finishBridgeRef timeout, making the thinking indicator stick forever.
**Pattern:** Stream listener useEffect ONLY depends on `conversation_id`. Access callbacks via `useLatestRef` to prevent re-subscription.

## 2026-02-06 — Don't fight upstream CLI architecture

**Trigger:** Spent a session trying to bolt image generation onto Gemini CLI's tool system. Required threading API keys through 6 files.
**Pattern:** If you're fighting the CLI's architecture to add a capability, STOP. It should be a first-class Foundry flow, not a CLI tool. "Stay thin at agent layer, orchestrate at platform layer."

## 2026-02-06 — getResponseText import source matters

**Trigger:** Imported `getResponseText` from local `./utils.ts` instead of `@office-ai/aioncli-core`.
**Pattern:** `./utils.ts` in the tools directory is ORPHANED (no longer imported). Always use the one from `@office-ai/aioncli-core`.

## 2026-02-08 — Brainstorm docs stored in Claude plans dir are invisible to new sessions

**Trigger:** 2,227-line brainstorm doc was at `C:\Users\seand\.claude\plans\temporal-wiggling-thompson.md`. New session couldn't find it. Took 3 explorer agents to locate.
**Pattern:** Critical planning documents MUST live in the project repo (`.foundry/VISION.md`, `BATTLEPLAN.md`, `tasks/`). Claude's plans directory is session-volatile — not a reliable persistent store.

## 2026-02-08 — DB CHECK constraints require table recreation

**Trigger:** Adding new conversation types or channel sources requires painful SQLite migrations because CHECK constraints can't be ALTERed.
**Pattern:** Never use SQL CHECK constraints for extensible enumerations. Validate at application layer with Zod. Decision D-004.

## 2026-02-08 — Memory system concerns (Phase 5)

**Trigger:** Built full persistent memory system with FTS5/BM25 search.
**Concerns to address:**

1. **Session extraction requires Gemini API key** — Falls back to basic summary if no key. Codex/ACP-only users get degraded extraction. Future: support OpenAI/Anthropic as extraction backends.
2. **No auto-pruning** — Memory accumulates indefinitely. Need importance decay + max-entry limits to prevent DB bloat on long-running projects.
3. **FTS5 query quality** — BM25 keyword search is literal. "deploy to production" won't match "push to prod". Vector embeddings (sqlite-vec/ONNX) would fix this — deferred spike.

## 2026-02-08 — FoundryDatabase is a wrapper, not raw SQLite

**Trigger:** In Session 5, tried raw SQL via `getDatabase()` — returns `FoundryDatabase` class, not raw better-sqlite3 handle.
**Pattern:** Use domain methods (`db.getUserConversations()`, `db.searchMemories()`, etc.) not raw SQL. Only use `db.prepare()` inside the FoundryDatabase class itself or in migrations.

## 2026-02-08 — IPC bridges must validate filesystem paths from renderer

**Trigger:** Security audit found path traversal in `voice.transcribe` and `voice.saveRecording`. The renderer can send arbitrary paths that the main process reads/writes without validation.
**Pattern:** ALWAYS validate filesystem paths received via IPC. Use `path.resolve()` and verify the resolved path starts with the expected base directory. Whitelist file extensions when they come from the renderer. This applies to ALL bridges that do file I/O, not just voice.

## 2026-02-08 — SSRF via user-configurable base URLs

**Trigger:** Signal plugin accepted user-configured `apiBaseUrl` and made fetch/WebSocket requests to it with no validation. Could hit cloud metadata endpoints.
**Pattern:** When accepting user-configured URLs for external services: (1) validate protocol is http/https, (2) block known internal/metadata IPs (169.254.169.254, etc.), (3) log prominently when non-localhost URLs are used.

## 2026-02-08 — Channel reconnect loops need backoff + max attempts

**Trigger:** WhatsApp plugin called `void this.onStart()` recursively on connection close with no backoff, no retry limit. A failing connection would loop indefinitely.
**Pattern:** All channel reconnection logic needs: (1) exponential backoff, (2) max attempt limit, (3) reset counter on successful connect, (4) set error status when exhausted.

## 2026-02-09 — "Build Service, Defer Wiring" is a trap

**Trigger:** Full product audit revealed ~40% of features are unreachable from UI. Ember has a complete backend but no button to create a conversation. Channel adapters have backends but no config forms (except Telegram). SendBoxSettingsPopover and ModelModeSelector look real but do nothing.
**Pattern:** Every session must end with a USER PATH verification: "How does a user actually access this feature?" If there's no answer, it's not done. A service without a UI entry point is not a shipped feature. A settings tab is not an entry point — it configures a feature, it doesn't provide access. Placeholder UIs that look real but do nothing are WORSE than nothing — they erode trust.

## 2026-02-09 — Removing a plugin type from union causes cascade errors

**Trigger:** Removed `'lark'` from `PluginType` union and Lark-specific fields (`appId`, `appSecret`) from `IPluginCredentials`. Signal and Slack plugins were reusing `appId` for their own credentials (Signal API base URL, Slack app-level token).
**Pattern:** Before removing shared type fields, grep for ALL usages across the codebase — not just the plugin being removed. Other plugins may have repurposed fields. When in doubt, keep generic fields like `appId` with updated comments.

## 2026-02-09 — TypeScript interfaces don't have implicit index signatures

**Trigger:** Changed `encryptCredentials` to accept `Record<string, string | undefined>`. TS error: `IPluginCredentials` not assignable — interfaces lack index signatures.
**Pattern:** Use generics with `<T extends object>` instead of `Record<string, ...>` when the function needs to accept both interfaces and record types. This preserves type inference while being permissive enough for interfaces.

## 2026-02-08 — IPC type narrowing: string vs literal union

**Trigger:** Compile errors when IPC interfaces use `string` but service types expect literal unions (e.g., `'openai' | 'local'`).
**Pattern:** IPC bridge types (ipcBridge.ts) use broad `string` types. Service types use narrow unions. Cast at the bridge layer with `as Partial<ServiceType>` or `as any`. The bridge is the type boundary.
