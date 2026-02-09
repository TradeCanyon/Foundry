# Foundry Security Audit Report

**Scope:** Phases 9A (Ember), 9B (Ember UI), 10 (Voice), 11 (Channels)
**Date:** 2026-02-08
**Auditor:** Claude Opus 4.6
**Framework:** OWASP Top 10 + Electron-specific concerns

---

## Files Reviewed

**Phase 9 - Ember (6 files):**

- `src/process/services/emberService.ts`
- `src/process/services/emberPersonality.ts`
- `src/process/bridge/emberBridge.ts`
- `src/renderer/pages/conversation/ember/EmberChat.tsx`
- `src/renderer/pages/conversation/ember/EmberSendBox.tsx`
- `src/renderer/components/SettingsModal/contents/EmberModalContent.tsx`

**Phase 10 - Voice (3 files):**

- `src/process/services/voiceService.ts`
- `src/process/bridge/voiceBridge.ts`
- `src/renderer/components/VoiceModeButton.tsx`

**Phase 11 - Channels (9 files):**

- `src/channels/plugins/whatsapp/WhatsAppPlugin.ts`
- `src/channels/plugins/whatsapp/WhatsAppAdapter.ts`
- `src/channels/plugins/discord/DiscordPlugin.ts`
- `src/channels/plugins/discord/DiscordAdapter.ts`
- `src/channels/plugins/slack/SlackPlugin.ts`
- `src/channels/plugins/slack/SlackAdapter.ts`
- `src/channels/plugins/signal/SignalPlugin.ts`
- `src/channels/plugins/signal/SignalAdapter.ts`
- `src/channels/core/ChannelManager.ts`

**Supporting files reviewed for context:**

- `src/channels/plugins/BasePlugin.ts`
- `src/channels/pairing/PairingService.ts`
- `src/channels/utils/credentialCrypto.ts`
- `src/channels/utils/rateLimiter.ts`
- `src/process/services/constitutionService.ts`
- `src/common/ipcBridge.ts`
- `src/preload.ts`

---

## CRITICAL (Severity 90-100)

### C-1. Path Traversal via IPC `voice.transcribe` -- Arbitrary File Read (Score: 95) -- FIXED

**File:** `src/process/services/voiceService.ts`, line 83-89
**File:** `src/process/bridge/voiceBridge.ts`, line 22-24

The `voice.transcribe` IPC handler accepted an `audioPath` parameter from the renderer process and read it with `fs.readFileSync(audioPath)` with zero validation. A compromised renderer or XSS exploit could invoke this to read any file on disk, then exfiltrate the contents through the OpenAI API.

**Fix applied:** Added `assertSafePath()` method that validates the resolved path starts with the voice temp directory. Called before `fs.readFileSync`.

---

### C-2. Path Traversal via IPC `voice.saveRecording` -- Arbitrary File Write (Score: 93) -- FIXED

**File:** `src/process/services/voiceService.ts`, line 174-178
**File:** `src/process/bridge/voiceBridge.ts`, line 30-33

The `voice.saveRecording` handler accepted a `format` parameter from the renderer that was interpolated directly into a file path. A malicious format like `../../evil` could write files outside the temp directory.

**Fix applied:** Added `ALLOWED_FORMATS` whitelist (`['webm', 'ogg', 'wav', 'mp3', 'opus']`). Any format not in the whitelist defaults to `'webm'`.

---

### C-3. SSRF via Signal Plugin -- User-Controlled Base URL (Score: 92) -- FIXED

**File:** `src/channels/plugins/signal/SignalPlugin.ts`, lines 46, 52, 65, 136

The Signal plugin took a user-configurable `apiBaseUrl` from credentials and made HTTP requests and WebSocket connections to it without URL validation. Could hit cloud metadata endpoints (169.254.169.254) or internal services.

**Fix applied:** Added `validateApiUrl()` static method that checks protocol (http/https only) and blocks known internal/metadata IP addresses.

---

### C-4. Prompt Injection via User Input in Ember Intent Classification (Score: 90) -- NOTED

**File:** `src/process/services/emberService.ts`, lines 157-170

User input is injected directly into the LLM classification prompt without escaping or boundary markers. A user could craft input to manipulate classification.

**Mitigating factors (defense-in-depth):**

- Input truncated to 500 chars for classification
- Output strictly validated against `validTypes.includes()`
- 3-second timeout prevents slow extraction
- Classification only affects routing, not data access

**Recommendation:** Use structured message format with separate system/user roles rather than embedding user input in a single prompt string.

---

## HIGH (Severity 80-89)

### H-1. WhatsApp Auth State Path Traversal (Score: 87) -- FIXED

**File:** `src/channels/plugins/whatsapp/WhatsAppPlugin.ts`, lines 51-52

The WhatsApp auth directory came directly from `config.credentials.token` and was passed to `useMultiFileAuthState()`.

**Fix applied:** Auth directory now always resolves to `path.join(app.getPath('userData'), 'whatsapp-auth')`, ignoring the credential value for filesystem operations.

---

### H-2. LLM Response Rendered Without Sanitization in EmberChat (Score: 85) -- SAFE (React JSX)

**File:** `src/renderer/pages/conversation/ember/EmberChat.tsx`, line 104

Ember's LLM responses rendered via `{msg.text}` inside a `div`. React's JSX escaping prevents XSS. Currently safe, but becomes exploitable if raw HTML rendering or a markdown renderer is ever added here without sanitization.

**Recommendation:** Add an explicit comment marking this as a security-sensitive rendering point. If markdown rendering is ever added, use DOMPurify + allowlist.

---

### H-3. Credential Encryption Only Covers `token` Field (Score: 84) -- DEFERRED

**File:** `src/channels/utils/credentialCrypto.ts`, lines 119-137

`encryptCredentials` and `decryptCredentials` only encrypt the `token` field. Several channel plugins store additional secrets in other fields:

- **Slack**: `appId` stores the app-level token (`xapp-...`)
- **Lark**: `appSecret`, `encryptKey`, `verificationToken`

**Recommendation:** Extend to encrypt all string fields in the credentials object.

---

### H-4. Unbounded Conversation History Growth in Ember (Score: 82) -- NOTED

**File:** `src/process/services/emberService.ts`, lines 128-129, 262-266

The `conversationHistory` array is bounded to 20 entries, but each entry can be several KB. The full history is sent to Gemini Flash on every call with no token budget enforcement.

**Recommendation:** Implement a token budget that truncates older history, or reduce `maxHistory` to 10 with a total character limit.

---

### H-5. No Input Length Validation on Ember Messages (Score: 81) -- FIXED

**File:** `src/process/bridge/emberBridge.ts`, line 22

The `ember.send` IPC handler passed `input` directly to `processMessage` with no length limit.

**Fix applied:** Input truncated to 10,000 characters at the bridge layer before processing.

---

### H-6. No Rate Limiting on Ember or Voice External API Calls (Score: 80) -- DEFERRED

**File:** `src/process/services/emberService.ts` (Gemini API calls)
**File:** `src/process/services/voiceService.ts` (OpenAI API calls)

Neither service implements rate limiting. Rapid calls could exhaust API quota or incur significant costs.

**Recommendation:** Add rate limiting using the existing `RateLimiter` class from `src/channels/utils/rateLimiter.ts`.

---

## MEDIUM (Severity 60-79)

### M-1. Constitution File Read Uses Unvalidated Workspace Path (Score: 75)

**File:** `src/process/services/constitutionService.ts`, line 78

The `workspace` parameter is user-provided. While `path.join` normalizes, a crafted workspace value could resolve to unintended locations. Impact limited (only reads `.foundry/constitution.md` relative to path).

---

### M-2. Signal WebSocket Reconnect Has No Backoff Jitter (Score: 65)

**File:** `src/channels/plugins/signal/SignalPlugin.ts`, lines 106-118

Exponential backoff uses `Math.pow(2, attempts)` without jitter. Multiple instances would retry at identical intervals (thundering herd). Low severity for a desktop app.

---

### M-3. WhatsApp Recursive Reconnect (Score: 70) -- FIXED

**File:** `src/channels/plugins/whatsapp/WhatsAppPlugin.ts`, lines 68-73

On connection close, the plugin called `void this.onStart()` recursively with no backoff, retry limit, or concurrent-start guard.

**Fix applied:** Added `reconnectAttempts` counter (max 5), exponential backoff (up to 30s), counter reset on successful connect, error status when exhausted.

---

### M-4. Ember Custom Personality Prompt Enables Indirect Prompt Injection (Score: 68)

**File:** `src/process/services/emberService.ts`, lines 414-416

Custom personality prompts are injected directly into the system prompt. A malicious custom prompt could override Ember's safety instructions. Risk is lower since only the local user can set this via Settings UI.

---

### M-5. Channel Raw Message Objects Stored in Unified Messages (Score: 65)

**Files:** All adapter files (WhatsApp, Discord, Slack, Signal)

Each adapter includes `raw: msg` in the unified message. Raw objects may contain tokens, session data, or sensitive platform-specific data that gets passed through the handling pipeline.

---

## LOW (Severity 40-59)

### L-1. `Math.random()` Used for IDs (Score: 55)

**File:** `src/process/services/emberService.ts`, lines 335, 433

Activity log IDs use `Math.random().toString(36)`. These are internal identifiers, not security tokens. The `PairingService` correctly uses `crypto.randomBytes()` for security-sensitive values.

---

### L-2. Base64 Fallback for Credential Storage (Score: 55)

**File:** `src/channels/utils/credentialCrypto.ts`, lines 50-57

When `safeStorage` is unavailable, credentials fall back to Base64 encoding (prefix `b64:`), which is trivially reversible. Documented as "obfuscation" but stored bot tokens are effectively plaintext.

---

### L-3. TTS Text Not Sanitized Before API Call (Score: 50)

**File:** `src/process/services/voiceService.ts`, line 152

TTS text is truncated to 4096 chars but not otherwise sanitized. Any content (including PII from conversation) goes to OpenAI's external API.

---

### L-4. Discord Interaction `customId` Parsing is Fragile (Score: 50)

**File:** `src/channels/plugins/discord/DiscordPlugin.ts`, lines 78-88

Button interaction handling splits `customId` by `:` positionally. The `parts.length >= 3` guard prevents crashes, but unexpected button IDs are silently ignored.

---

## INFO (Positive Observations)

### I-1. IPC Security Model is Sound

The IPC bridge uses `contextBridge.exposeInMainWorld` with proper context isolation. No `nodeIntegration: true` in main window webPreferences.

### I-2. Pairing Service Security is Well-Designed

Cryptographic random codes, confusable character exclusion, rate limiting, time-limited codes (10-minute expiry), automatic cleanup.

### I-3. RateLimiter Implementation is Correct

Sliding-window rate limiter with proper memory cleanup via `purge()`.

### I-4. Credential Crypto Uses Electron safeStorage When Available

Primary encryption uses OS keychain/DPAPI/libsecret via `safeStorage` API.

---

## Summary

| Severity | Count | Fixed | Deferred | Noted |
| -------- | ----- | ----- | -------- | ----- |
| CRITICAL | 4     | 3     | 0        | 1     |
| HIGH     | 6     | 3     | 2        | 1     |
| MEDIUM   | 5     | 1     | 0        | 4     |
| LOW      | 4     | 0     | 0        | 4     |
| INFO     | 4     | -     | -        | 4     |

**Remediation applied this session:**

1. C-1: `assertSafePath()` in voiceService.ts
2. C-2: `ALLOWED_FORMATS` whitelist in voiceService.ts
3. C-3: `validateApiUrl()` in SignalPlugin.ts
4. H-1: Auth dir hardened to app data in WhatsAppPlugin.ts
5. H-5: 10K char input limit in emberBridge.ts
6. M-3: Reconnect backoff + max attempts in WhatsAppPlugin.ts

**Deferred items (tracked in `.foundry/todo.md` as SA.F):**

1. H-3: Extend `encryptCredentials` to all sensitive credential fields
2. H-6: Rate limiting on Ember/Voice external API calls
