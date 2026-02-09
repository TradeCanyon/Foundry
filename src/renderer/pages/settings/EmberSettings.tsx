/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import EmberModalContent from '@/renderer/components/SettingsModal/contents/EmberModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const EmberSettings: React.FC = () => {
  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      <EmberModalContent />
    </SettingsPageWrapper>
  );
};

export default EmberSettings;
