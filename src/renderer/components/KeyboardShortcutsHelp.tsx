/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Modal, Typography } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { Keyboard } from '@icon-park/react';

interface ShortcutItem {
  keys: string[];
  action: string;
  category: string;
}

/**
 * Keyboard shortcuts help overlay
 * Triggered by pressing '?' key
 */
const KeyboardShortcutsHelp: React.FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  const shortcuts: ShortcutItem[] = [
    // General
    { keys: ['?'], action: t('shortcuts.showHelp', 'Show keyboard shortcuts'), category: t('shortcuts.categories.general', 'General') },
    { keys: ['Esc'], action: t('shortcuts.stopGeneration', 'Stop generation / Cancel'), category: t('shortcuts.categories.general', 'General') },
    { keys: ['Ctrl', 'Enter'], action: t('shortcuts.sendMessage', 'Send message'), category: t('shortcuts.categories.general', 'General') },

    // Navigation
    { keys: ['Ctrl', 'N'], action: t('shortcuts.newChat', 'New conversation'), category: t('shortcuts.categories.navigation', 'Navigation') },
    { keys: ['Ctrl', ','], action: t('shortcuts.openSettings', 'Open settings'), category: t('shortcuts.categories.navigation', 'Navigation') },
    { keys: ['Ctrl', '/'], action: t('shortcuts.focusInput', 'Focus input field'), category: t('shortcuts.categories.navigation', 'Navigation') },
    { keys: ['Ctrl', 'P'], action: t('shortcuts.togglePreview', 'Toggle preview panel'), category: t('shortcuts.categories.navigation', 'Navigation') },
    { keys: ['Ctrl', 'B'], action: t('shortcuts.toggleSidebar', 'Toggle sidebar'), category: t('shortcuts.categories.navigation', 'Navigation') },

    // Actions
    { keys: ['Ctrl', 'Shift', 'C'], action: t('shortcuts.copyLastResponse', 'Copy last AI response'), category: t('shortcuts.categories.actions', 'Actions') },
    { keys: ['\u2191'], action: t('shortcuts.editLastMessage', 'Edit last message (when input empty)'), category: t('shortcuts.categories.actions', 'Actions') },

    // Editor
    { keys: ['Ctrl', 'A'], action: t('shortcuts.selectAll', 'Select all'), category: t('shortcuts.categories.editor', 'Editor') },
    { keys: ['Ctrl', 'C'], action: t('shortcuts.copy', 'Copy'), category: t('shortcuts.categories.editor', 'Editor') },
    { keys: ['Ctrl', 'V'], action: t('shortcuts.paste', 'Paste'), category: t('shortcuts.categories.editor', 'Editor') },

    // Zoom
    { keys: ['Ctrl', '+'], action: t('shortcuts.zoomIn', 'Zoom in'), category: t('shortcuts.categories.view', 'View') },
    { keys: ['Ctrl', '-'], action: t('shortcuts.zoomOut', 'Zoom out'), category: t('shortcuts.categories.view', 'View') },
    { keys: ['Ctrl', '0'], action: t('shortcuts.resetZoom', 'Reset zoom'), category: t('shortcuts.categories.view', 'View') },
  ];

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<string, ShortcutItem[]>
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only trigger if no modifier keys and not in input/textarea
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (!isInputField) {
        e.preventDefault();
        setVisible(true);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const renderKeyCombo = (keys: string[]) => {
    return (
      <div className='flex items-center gap-4px'>
        {keys.map((key, idx) => (
          <React.Fragment key={idx}>
            <kbd className='px-6px py-2px bg-fill-2 rd-4px text-12px font-mono text-t-primary b-1 b-fill-3'>{key}</kbd>
            {idx < keys.length - 1 && <span className='text-t-tertiary'>+</span>}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <Modal
      visible={visible}
      onCancel={() => setVisible(false)}
      title={
        <div className='flex items-center gap-8px'>
          <Keyboard size={18} />
          {t('shortcuts.title', 'Keyboard Shortcuts')}
        </div>
      }
      footer={null}
      style={{ maxWidth: '500px' }}
    >
      <div className='flex flex-col gap-16px'>
        {Object.entries(groupedShortcuts).map(([category, items]) => (
          <div key={category}>
            <Typography.Title heading={6} className='mb-8px text-t-secondary'>
              {category}
            </Typography.Title>
            <div className='flex flex-col gap-8px'>
              {items.map((item, idx) => (
                <div key={idx} className='flex items-center justify-between'>
                  <span className='text-14px text-t-primary'>{item.action}</span>
                  {renderKeyCombo(item.keys)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default KeyboardShortcutsHelp;
