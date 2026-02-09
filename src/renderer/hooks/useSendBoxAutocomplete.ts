/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Autocomplete hook for the SendBox.
 * Handles @mention (agents, MCP servers) and /command (prompts, actions) triggers.
 */

import { useMcpServers } from '@/renderer/hooks/mcp/useMcpServers';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface AutocompleteOption {
  key: string;
  label: string;
  description: string;
  category: string;
  insertText?: string;
  execute?: () => void;
}

// @ trigger — matches @query at end of input (after space or at start)
const MENTION_REGEX = /(?:^|\s)@(\S*)$/;
// / trigger — matches /command only when entire input is the command (no prior content)
const COMMAND_REGEX = /^\/(\S*)$/;

const BUILT_IN_AGENTS: AutocompleteOption[] = [
  { key: '@gemini', label: 'Gemini', description: 'Google AI', category: 'Agents', insertText: '@Gemini ' },
  { key: '@claude', label: 'Claude', description: 'Anthropic', category: 'Agents', insertText: '@Claude ' },
  { key: '@codex', label: 'Codex', description: 'OpenAI', category: 'Agents', insertText: '@Codex ' },
  { key: '@ember', label: 'Ember', description: 'Personal assistant', category: 'Agents', insertText: '@Ember ' },
];

const PROMPT_COMMANDS: AutocompleteOption[] = [
  { key: '/review', label: 'Review', description: 'Code review for bugs and best practices', category: 'Prompts', insertText: 'Review this code for bugs, security issues, and best practices:\n\n' },
  { key: '/explain', label: 'Explain', description: 'Get a detailed explanation', category: 'Prompts', insertText: 'Explain the following in detail:\n\n' },
  { key: '/fix', label: 'Fix', description: 'Debug and fix a problem', category: 'Prompts', insertText: 'Fix the following issue:\n\n' },
  { key: '/test', label: 'Test', description: 'Generate comprehensive tests', category: 'Prompts', insertText: 'Write comprehensive tests for:\n\n' },
  { key: '/refactor', label: 'Refactor', description: 'Improve code structure and clarity', category: 'Prompts', insertText: 'Refactor for clarity and maintainability:\n\n' },
  { key: '/document', label: 'Document', description: 'Generate documentation', category: 'Prompts', insertText: 'Write clear documentation for:\n\n' },
  { key: '/summarize', label: 'Summarize', description: 'Create a concise summary', category: 'Prompts', insertText: 'Summarize the following:\n\n' },
];

export function useSendBoxAutocomplete(
  input: string,
  setInput: (value: string) => void,
  isComposing: React.MutableRefObject<boolean>,
  isFocused: boolean
): {
  isOpen: boolean;
  trigger: '@' | '/' | null;
  query: string;
  activeIndex: number;
  filteredOptions: AutocompleteOption[];
  menuRef: React.RefObject<HTMLDivElement | null>;
  handleSelect: (option: AutocompleteOption) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
} {
  const navigate = useNavigate();
  const { mcpServers } = useMcpServers();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Action commands (need navigate reference)
  const actionCommands: AutocompleteOption[] = useMemo(
    () => [
      { key: '/new', label: 'New Chat', description: 'Start a new conversation', category: 'Actions', execute: () => navigate('/guid') },
      { key: '/image', label: 'New Image', description: 'Generate an image', category: 'Actions', execute: () => navigate('/guid', { state: { mode: 'image' } }) },
      { key: '/settings', label: 'Settings', description: 'Open settings', category: 'Actions', execute: () => navigate('/settings/gemini') },
    ],
    [navigate]
  );

  const allCommands = useMemo(() => [...PROMPT_COMMANDS, ...actionCommands], [actionCommands]);

  // @mention options: built-in agents + enabled MCP servers
  const mentionOptions = useMemo(() => {
    const options = [...BUILT_IN_AGENTS];
    const enabled = mcpServers.filter((s) => s.enabled);
    for (const server of enabled) {
      options.push({
        key: `@mcp-${server.name}`,
        label: server.name,
        description: 'MCP Server',
        category: 'MCP Servers',
        insertText: `@${server.name} `,
      });
    }
    return options;
  }, [mcpServers]);

  // Detect trigger from current input value (synchronous, no useEffect needed)
  const { trigger, query } = useMemo(() => {
    const cmdMatch = input.match(COMMAND_REGEX);
    if (cmdMatch) return { trigger: '/' as const, query: cmdMatch[1] };
    const mentionMatch = input.match(MENTION_REGEX);
    if (mentionMatch) return { trigger: '@' as const, query: mentionMatch[1] };
    return { trigger: null as '@' | '/' | null, query: '' };
  }, [input]);

  const currentKey = trigger ? `${trigger}:${query}` : null;

  // Filter options based on trigger and query
  const filteredOptions = useMemo(() => {
    if (!trigger) return [];
    const source = trigger === '/' ? allCommands : mentionOptions;
    if (!query) return source;
    const q = query.toLowerCase();
    return source.filter((opt) => {
      const label = opt.label.toLowerCase();
      const key = opt.key.toLowerCase().replace(/^[@/]/, '');
      return key.startsWith(q) || label.startsWith(q) || label.includes(q);
    });
  }, [trigger, query, allCommands, mentionOptions]);

  const isOpen = isFocused && currentKey !== null && currentKey !== dismissedKey && filteredOptions.length > 0;

  // Clamp activeIndex for display (synchronous)
  const safeIndex = filteredOptions.length > 0 ? Math.min(activeIndex, filteredOptions.length - 1) : 0;

  // Reset activeIndex when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [trigger, query]);

  // Scroll active item into view
  useEffect(() => {
    if (!isOpen) return;
    const container = menuRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-ac-index="${safeIndex}"]`);
    if (target) target.scrollIntoView({ block: 'nearest' });
  }, [safeIndex, isOpen]);

  const handleSelect = useCallback(
    (option: AutocompleteOption) => {
      if (option.execute) {
        option.execute();
        setInput('');
      } else if (option.insertText) {
        if (trigger === '/') {
          // Replace entire input with prompt template
          setInput(option.insertText);
        } else if (trigger === '@') {
          // Replace the @query at end of input with mention text
          const newInput = input.replace(MENTION_REGEX, (match) => {
            const prefix = /^\s/.test(match) ? ' ' : '';
            return prefix + option.insertText!;
          });
          setInput(newInput || option.insertText);
        }
      }
      setDismissedKey(null);
    },
    [input, trigger, setInput]
  );

  // Returns true if the event was consumed by autocomplete
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (isComposing.current || !isOpen) return false;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => {
            const safe = Math.min(prev, filteredOptions.length - 1);
            return (safe + 1) % filteredOptions.length;
          });
          return true;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => {
            const safe = Math.min(prev, filteredOptions.length - 1);
            return (safe - 1 + filteredOptions.length) % filteredOptions.length;
          });
          return true;
        case 'Enter':
          if (e.shiftKey) return false;
          e.preventDefault();
          handleSelect(filteredOptions[safeIndex]);
          return true;
        case 'Tab':
          e.preventDefault();
          handleSelect(filteredOptions[safeIndex]);
          return true;
        case 'Escape':
          e.preventDefault();
          setDismissedKey(currentKey);
          return true;
        default:
          return false;
      }
    },
    [isOpen, filteredOptions, safeIndex, handleSelect, currentKey, isComposing]
  );

  return {
    isOpen,
    trigger,
    query,
    activeIndex: safeIndex,
    filteredOptions,
    menuRef,
    handleSelect,
    handleKeyDown,
  };
}
