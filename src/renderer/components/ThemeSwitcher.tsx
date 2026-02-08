/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useThemeContext } from '@/renderer/context/ThemeContext';
import FoundrySelect from '@/renderer/components/base/FoundrySelect';
import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Theme switcher component
 *
 * Provides light/dark mode switching functionality
 */
export const ThemeSwitcher = () => {
  const { theme, setTheme } = useThemeContext();
  const { t } = useTranslation();

  return (
    <div className='flex items-center gap-8px'>
      {/* Light/Dark mode selector */}
      <FoundrySelect value={theme} onChange={setTheme} className='w-160px'>
        <FoundrySelect.Option value='light'>{t('settings.lightMode')}</FoundrySelect.Option>
        <FoundrySelect.Option value='dark'>{t('settings.darkMode')}</FoundrySelect.Option>
      </FoundrySelect>
    </div>
  );
};
