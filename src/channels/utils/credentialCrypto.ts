/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Credential storage utilities
 * Uses Electron safeStorage (OS keychain — DPAPI on Windows, Keychain on macOS,
 * libsecret on Linux) for real encryption. Falls back to Base64 if safeStorage
 * is unavailable (e.g. Linux without a keyring).
 *
 * Storage format prefixes:
 *   safe:<base64>  — safeStorage encrypted (current)
 *   b64:<base64>   — Base64 obfuscation (legacy v1)
 *   enc:<base64>   — safeStorage legacy format (pre-rebrand)
 *   plain:<text>   — plain text fallback
 *   <no prefix>    — ancient unencoded value
 */

import { safeStorage } from 'electron';

/**
 * Check if OS-level encryption is available
 */
export function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/**
 * Encrypt a string value for storage
 */
export function encryptString(plaintext: string): string {
  if (!plaintext) return '';

  // Prefer safeStorage (real encryption via OS keychain)
  if (isEncryptionAvailable()) {
    try {
      const encrypted = safeStorage.encryptString(plaintext);
      return `safe:${encrypted.toString('base64')}`;
    } catch (error) {
      console.error('[CredentialStorage] safeStorage encryption failed, falling back to Base64:', error);
    }
  }

  // Fallback: Base64 obfuscation
  try {
    const encoded = Buffer.from(plaintext, 'utf-8').toString('base64');
    return `b64:${encoded}`;
  } catch (error) {
    console.error('[CredentialStorage] Encoding failed:', error);
    return `plain:${plaintext}`;
  }
}

/**
 * Decrypt a previously encrypted string.
 * Handles all historical formats for backwards compatibility.
 */
export function decryptString(encoded: string): string {
  if (!encoded) return '';

  // Current format: safeStorage encrypted
  if (encoded.startsWith('safe:')) {
    try {
      const buffer = Buffer.from(encoded.slice(5), 'base64');
      return safeStorage.decryptString(buffer);
    } catch (error) {
      console.error('[CredentialStorage] safeStorage decryption failed:', error);
      return '';
    }
  }

  // Legacy: Base64 obfuscation
  if (encoded.startsWith('b64:')) {
    try {
      return Buffer.from(encoded.slice(4), 'base64').toString('utf-8');
    } catch (error) {
      console.error('[CredentialStorage] Base64 decoding failed:', error);
      return '';
    }
  }

  // Legacy: old safeStorage format (pre-rebrand enc: prefix)
  if (encoded.startsWith('enc:')) {
    // Try safeStorage first (original format was safeStorage)
    try {
      const buffer = Buffer.from(encoded.slice(4), 'base64');
      return safeStorage.decryptString(buffer);
    } catch {
      // Fall back to Base64 decode (some installs used Base64 with enc: prefix)
      try {
        return Buffer.from(encoded.slice(4), 'base64').toString('utf-8');
      } catch {
        console.error('[CredentialStorage] Cannot decode legacy enc: format');
        return '';
      }
    }
  }

  // Legacy: plain text prefix
  if (encoded.startsWith('plain:')) {
    return encoded.slice(6);
  }

  // Ancient: no prefix, return as-is
  console.warn('[CredentialStorage] Found legacy unencoded value, returning as-is');
  return encoded;
}

/**
 * Encrypt credentials object.
 * Only encrypts sensitive fields (token).
 */
export function encryptCredentials(credentials: { token?: string } | undefined): { token?: string } | undefined {
  if (!credentials) return undefined;

  return {
    ...credentials,
    token: credentials.token ? encryptString(credentials.token) : undefined,
  };
}

/**
 * Decrypt credentials object.
 */
export function decryptCredentials(credentials: { token?: string } | undefined): { token?: string } | undefined {
  if (!credentials) return undefined;

  return {
    ...credentials,
    token: credentials.token ? decryptString(credentials.token) : undefined,
  };
}
