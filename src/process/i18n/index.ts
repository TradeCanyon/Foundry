/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import i18n from 'i18next';

import enUS from '@/renderer/i18n/locales/en-US.json';

const resources = {
  'en-US': {
    translation: enUS,
  },
};

// Initialize i18next for main process
i18n
  .init({
    resources,
    lng: 'en-US',
    fallbackLng: 'en-US',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  })
  .catch((error) => {
    console.error('[Main Process] Failed to initialize i18n:', error);
  });

export default i18n;
