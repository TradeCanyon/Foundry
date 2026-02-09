/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ConversationSearch — Sidebar search bar for filtering conversations.
 * Client-side filtering with debounced input.
 */

import { Search, Close } from '@icon-park/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ConversationSearchProps {
  onSearch: (query: string) => void;
}

const ConversationSearch: React.FC<ConversationSearchProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { t } = useTranslation();

  // Debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearch(query);
    }, 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, onSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  }, [onSearch]);

  // Ctrl/Cmd+K shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        margin: '4px 8px 8px',
        borderRadius: '8px',
        border: `1px solid ${focused ? 'var(--primary)' : 'var(--bg-3)'}`,
        backgroundColor: 'var(--bg-1)',
        transition: 'border-color 0.2s',
      }}
    >
      <Search theme='outline' size='16' fill='var(--text-secondary)' style={{ flexShrink: 0 }} />
      <input
        ref={inputRef}
        type='text'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={t('conversation.history.search', { defaultValue: 'Search...' })}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          backgroundColor: 'transparent',
          color: 'var(--text-primary)',
          fontSize: '13px',
          lineHeight: '24px',
          padding: 0,
        }}
      />
      {query && <Close theme='outline' size='14' fill='var(--text-secondary)' style={{ cursor: 'pointer', flexShrink: 0 }} onClick={handleClear} />}
    </div>
  );
};

export default ConversationSearch;
