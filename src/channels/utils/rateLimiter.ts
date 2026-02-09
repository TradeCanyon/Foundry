/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * In-memory sliding-window rate limiter.
 * Tracks attempts by key (e.g. IP, platform user ID) within a configurable window.
 */
export class RateLimiter {
  private attempts = new Map<string, number[]>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(opts: { maxAttempts: number; windowMs: number }) {
    this.maxAttempts = opts.maxAttempts;
    this.windowMs = opts.windowMs;
  }

  /**
   * Check if an action is allowed for the given key.
   * Records the attempt and returns whether it's within the limit.
   */
  check(key: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing attempts, filter to current window
    const existing = (this.attempts.get(key) || []).filter((t) => t > windowStart);

    if (existing.length >= this.maxAttempts) {
      // Rate limited — calculate when the oldest attempt in window expires
      const oldestInWindow = existing[0];
      const retryAfterMs = oldestInWindow + this.windowMs - now;
      this.attempts.set(key, existing);
      return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
    }

    // Allowed — record this attempt
    existing.push(now);
    this.attempts.set(key, existing);
    return { allowed: true, retryAfterMs: 0 };
  }

  /**
   * Reset attempts for a key (e.g. after successful auth).
   */
  reset(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Purge expired entries to prevent memory leaks.
   * Call periodically for long-lived limiters.
   */
  purge(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [key, timestamps] of this.attempts) {
      const active = timestamps.filter((t) => t > windowStart);
      if (active.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, active);
      }
    }
  }
}
