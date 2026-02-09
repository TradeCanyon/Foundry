/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Playwright browser singleton + persistent session manager.
 *
 * The singleton browser instance is shared across WebFetch and Browser Agent tools.
 * Browser Agent tools additionally get a persistent Page per conversation via
 * BrowserSessionManager, which auto-closes idle sessions after 30 minutes.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // Check every minute
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ---------------------------------------------------------------------------
// Browser singleton — reused across all fetches & browser agent sessions
// ---------------------------------------------------------------------------

let _browser: Browser | null = null;
let _browserLaunchPromise: Promise<Browser | null> | null = null;
let _browserAvailable = true;

export async function getOrCreateBrowser(): Promise<Browser> {
  if (!_browserAvailable) throw new Error('No system browser available');
  if (_browser?.isConnected()) return _browser;

  // Prevent multiple concurrent launch attempts
  if (_browserLaunchPromise) {
    const result = await _browserLaunchPromise;
    if (result) return result;
    throw new Error('Browser launch failed');
  }

  _browserLaunchPromise = (async (): Promise<Browser | null> => {
    const channels = process.platform === 'win32' ? ['msedge', 'chrome', 'chromium'] : ['chrome', 'chromium'];

    for (const channel of channels) {
      try {
        _browser = await chromium.launch({
          channel,
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
        });

        _browser.on('disconnected', () => {
          _browser = null;
          _browserLaunchPromise = null;
        });

        return _browser;
      } catch {
        continue;
      }
    }

    _browserAvailable = false;
    return null;
  })();

  try {
    const result = await _browserLaunchPromise;
    if (!result) throw new Error('No system browser found (Chrome, Edge, or Chromium required)');
    return result;
  } catch (e) {
    _browserLaunchPromise = null;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Stealth init script — removes automation markers
// ---------------------------------------------------------------------------

export async function applyStealthScripts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    (window as any).chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };
    const origQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
    window.navigator.permissions.query = (params: any) => (params.name === 'notifications' ? Promise.resolve({ state: Notification.permission } as PermissionStatus) : origQuery(params));
  });
}

// ---------------------------------------------------------------------------
// BrowserSession — persistent context + page per conversation
// ---------------------------------------------------------------------------

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
  lastActivity: number;
}

const _sessions = new Map<string, BrowserSession>();
let _cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanupInterval(): void {
  if (_cleanupInterval) return;
  _cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of _sessions) {
      if (now - session.lastActivity > SESSION_IDLE_TIMEOUT_MS) {
        void session.context.close().catch(() => {});
        _sessions.delete(id);
      }
    }
    if (_sessions.size === 0 && _cleanupInterval) {
      clearInterval(_cleanupInterval);
      _cleanupInterval = null;
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Get or create a persistent browser session for a conversation.
 * If the page has been closed/crashed, it recreates the session.
 */
export async function getOrCreateSession(conversationId: string): Promise<BrowserSession> {
  const existing = _sessions.get(conversationId);
  if (existing && !existing.page.isClosed()) {
    existing.lastActivity = Date.now();
    return existing;
  }

  // Clean up stale session if page crashed
  if (existing) {
    void existing.context.close().catch(() => {});
    _sessions.delete(conversationId);
  }

  const browser = await getOrCreateBrowser();
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    ignoreHTTPSErrors: true,
    viewport: { width: 1024, height: 768 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  const page = await context.newPage();
  await applyStealthScripts(page);

  const session: BrowserSession = {
    context,
    page,
    lastActivity: Date.now(),
  };

  _sessions.set(conversationId, session);
  ensureCleanupInterval();
  return session;
}

/**
 * Get an existing session (returns undefined if none exists).
 */
export function getSession(conversationId: string): BrowserSession | undefined {
  const session = _sessions.get(conversationId);
  if (session && !session.page.isClosed()) {
    return session;
  }
  return undefined;
}

/**
 * Close and remove a session.
 */
export async function closeSession(conversationId: string): Promise<void> {
  const session = _sessions.get(conversationId);
  if (session) {
    await session.context.close().catch(() => {});
    _sessions.delete(conversationId);
  }
}

/**
 * Take a screenshot of the current page, returned as base64 JPEG.
 * Uses JPEG at 50% quality to keep the image small enough for LLM context.
 */
export async function takeScreenshot(page: Page): Promise<string> {
  const buffer = await page.screenshot({ type: 'jpeg', quality: 50, fullPage: false });
  return buffer.toString('base64');
}

/** MIME type for screenshots (matches takeScreenshot format). */
export const SCREENSHOT_MIME_TYPE = 'image/jpeg';
