/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import McpStoreModalContent from '@/renderer/components/SettingsModal/contents/McpStoreModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const McpStoreSettings: React.FC = () => {
  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      <McpStoreModalContent />
    </SettingsPageWrapper>
  );
};

export default McpStoreSettings;
