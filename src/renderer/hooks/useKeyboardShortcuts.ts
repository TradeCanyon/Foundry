/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useCallback, useRef } from 'react';

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /** Key combination (e.g., 'ctrl+k', 'escape', 'shift+?') */
  key: string;
  /** Callback when shortcut is triggered */
  handler: (e: KeyboardEvent) => void;
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
  /** Whether to allow in input fields */
  allowInInput?: boolean;
  /** Description for help display */
  description?: string;
  /** Category for grouping in help display */
  category?: string;
}

/**
 * Parse a key string into its components
 */
const parseKeyCombo = (keyString: string): { key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean } => {
  const parts = keyString
    .toLowerCase()
    .split('+')
    .map((p) => p.trim());
  const key = parts.pop() || '';

  return {
    key,
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
  };
};

/**
 * Check if the event matches the key combo
 */
const matchesKeyCombo = (e: KeyboardEvent, combo: ReturnType<typeof parseKeyCombo>): boolean => {
  const eventKey = e.key.toLowerCase();

  // Handle special keys
  const keyMatches = eventKey === combo.key || (combo.key === 'escape' && eventKey === 'escape') || (combo.key === 'enter' && eventKey === 'enter') || (combo.key === 'space' && eventKey === ' ') || (combo.key === '?' && e.key === '?'); // Handle shift+/ = ?

  return keyMatches && e.ctrlKey === combo.ctrl && e.shiftKey === combo.shift && e.altKey === combo.alt && e.metaKey === combo.meta;
};

/**
 * Check if the target is an input field
 */
const isInputField = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toUpperCase();
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable;
};

/**
 * Hook for registering keyboard shortcuts
 *
 * @example
 * useKeyboardShortcuts([
 *   { key: 'ctrl+k', handler: () => openCommandPalette() },
 *   { key: 'escape', handler: () => stopGeneration() },
 *   { key: '?', handler: () => showHelp(), allowInInput: false },
 * ]);
 */
export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[], enabled = true): void => {
  // Use ref to avoid recreating handler on every render
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      for (const shortcut of shortcutsRef.current) {
        const combo = parseKeyCombo(shortcut.key);

        if (matchesKeyCombo(e, combo)) {
          // Check if in input field
          if (!shortcut.allowInInput && isInputField(e.target)) {
            continue;
          }

          // Prevent default if specified
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }

          shortcut.handler(e);
          return;
        }
      }
    },
    [enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

/**
 * Common shortcuts for Foundry application
 * Use these in combination with useKeyboardShortcuts
 */
export const FOUNDRY_SHORTCUTS = {
  // General
  SHOW_HELP: '?',
  STOP_GENERATION: 'escape',
  SEND_MESSAGE: 'ctrl+enter',

  // Navigation
  NEW_CHAT: 'ctrl+n',
  OPEN_SETTINGS: 'ctrl+,',
  FOCUS_INPUT: 'ctrl+/',
  TOGGLE_PREVIEW: 'ctrl+p',

  // Actions
  COPY_LAST_RESPONSE: 'ctrl+shift+c',
  EDIT_LAST_MESSAGE: 'arrowup', // When input is empty

  // Window
  TOGGLE_SIDEBAR: 'ctrl+b',
  ZOOM_IN: 'ctrl+=',
  ZOOM_OUT: 'ctrl+-',
  RESET_ZOOM: 'ctrl+0',
} as const;

export default useKeyboardShortcuts;
