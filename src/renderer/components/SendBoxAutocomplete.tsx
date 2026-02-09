/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SendBoxAutocomplete — Dropdown overlay for @mention and /command autocomplete.
 * Renders above the sendbox textarea, grouped by category.
 */

import type { AutocompleteOption } from '@/renderer/hooks/useSendBoxAutocomplete';
import React, { useMemo } from 'react';

interface SendBoxAutocompleteProps {
  isOpen: boolean;
  trigger: '@' | '/' | null;
  filteredOptions: AutocompleteOption[];
  activeIndex: number;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (option: AutocompleteOption) => void;
}

/** Group options by category, preserving insertion order */
function groupByCategory(options: AutocompleteOption[]): Array<{ category: string; items: AutocompleteOption[] }> {
  const groups: Array<{ category: string; items: AutocompleteOption[] }> = [];
  const categoryMap = new Map<string, AutocompleteOption[]>();

  for (const opt of options) {
    let items = categoryMap.get(opt.category);
    if (!items) {
      items = [];
      categoryMap.set(opt.category, items);
      groups.push({ category: opt.category, items });
    }
    items.push(opt);
  }
  return groups;
}

const SendBoxAutocomplete: React.FC<SendBoxAutocompleteProps> = ({ isOpen, trigger, filteredOptions, activeIndex, menuRef, onSelect }) => {
  const groups = useMemo(() => groupByCategory(filteredOptions), [filteredOptions]);

  if (!isOpen) return null;

  // Build a flat index to track which option is at which position
  let flatIndex = 0;

  return (
    <div
      ref={menuRef}
      // Prevent textarea blur when clicking dropdown items
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        marginBottom: '4px',
        zIndex: 100,
        maxHeight: '280px',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: 'var(--bg-2)',
        border: '1px solid var(--color-border-2)',
        borderRadius: '12px',
        boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.08), 0 0 0 1px var(--color-border-2)',
      }}
    >
      {groups.map((group) => (
        <div key={group.category}>
          {/* Category header */}
          <div
            style={{
              padding: '6px 12px 2px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              userSelect: 'none',
            }}
          >
            {group.category}
          </div>
          {/* Items */}
          {group.items.map((option) => {
            const idx = flatIndex++;
            const isActive = idx === activeIndex;
            return (
              <div
                key={option.key}
                data-ac-index={idx}
                onClick={() => onSelect(option)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  backgroundColor: isActive ? 'var(--fill-2)' : 'transparent',
                  transition: 'background-color 0.1s',
                  borderRadius: '4px',
                  margin: '0 4px',
                }}
              >
                {/* Trigger badge */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '22px',
                    height: '22px',
                    borderRadius: '6px',
                    backgroundColor: isActive ? 'var(--fill-3)' : 'var(--fill-1)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                >
                  {trigger === '/' ? '/' : '@'}
                </span>
                {/* Text */}
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {option.label}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-tertiary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {option.description}
                  </div>
                </div>
                {/* Keyboard hint on active item */}
                {isActive && (
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-tertiary)',
                      flexShrink: 0,
                      opacity: 0.7,
                    }}
                  >
                    {option.execute ? 'Enter to run' : 'Enter to insert'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {/* Footer hint */}
      <div
        style={{
          padding: '4px 12px 6px',
          fontSize: '10px',
          color: 'var(--text-tertiary)',
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          userSelect: 'none',
          borderTop: '1px solid var(--color-border-2)',
          marginTop: '2px',
          opacity: 0.7,
        }}
      >
        <span>
          <kbd style={{ fontFamily: 'inherit' }}>↑↓</kbd> navigate
        </span>
        <span>
          <kbd style={{ fontFamily: 'inherit' }}>↵</kbd> select
        </span>
        <span>
          <kbd style={{ fontFamily: 'inherit' }}>esc</kbd> close
        </span>
      </div>
    </div>
  );
};

export default SendBoxAutocomplete;
