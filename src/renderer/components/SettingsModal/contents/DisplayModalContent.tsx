/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import FontSizeControl from '@/renderer/components/FontSizeControl';
import { ThemeSwitcher } from '@/renderer/components/ThemeSwitcher';
import FoundryScrollArea from '@/renderer/components/base/FoundryScrollArea';
import { useSettingsViewMode } from '../settingsViewContext';

/**
 * Preference row component
 * Used for displaying labels and corresponding controls in a unified horizontal layout
 */
const PreferenceRow: React.FC<{
  /** Label text */
  label: string;
  /** Control element */
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div className='flex items-center justify-between gap-24px py-12px'>
    <div className='text-14px text-2'>{label}</div>
    <div className='flex-1 flex justify-end'>{children}</div>
  </div>
);

/**
 * Display settings content component
 *
 * Provides display-related configuration options including theme, zoom scale and custom CSS
 *
 * @features
 * - Theme: light/dark/system
 * - Zoom scale control
 * - Custom CSS editor
 */
const DisplayModalContent: React.FC = () => {
  const { t } = useTranslation();
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  // Display settings items
  const displayItems = [
    { key: 'theme', label: t('settings.theme'), component: <ThemeSwitcher /> },
    { key: 'fontSize', label: t('settings.fontSize'), component: <FontSizeControl /> },
  ];

  return (
    <div className='flex flex-col h-full w-full'>
      <FoundryScrollArea className='flex-1 min-h-0 pb-16px' disableOverflow={isPageMode}>
        <div className='space-y-16px'>
          {/* Display Settings */}
          <div className='px-[12px] md:px-[32px] py-16px bg-2 rd-16px space-y-12px'>
            <div className='w-full flex flex-col divide-y divide-border-2'>
              {displayItems.map((item) => (
                <PreferenceRow key={item.key} label={item.label}>
                  {item.component}
                </PreferenceRow>
              ))}
            </div>
          </div>
        </div>
      </FoundryScrollArea>
    </div>
  );
};

export default DisplayModalContent;
