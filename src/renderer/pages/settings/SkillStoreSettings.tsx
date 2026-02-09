/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import SkillStoreModalContent from '@/renderer/components/SettingsModal/contents/SkillStoreModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const SkillStoreSettings: React.FC = () => {
  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      <SkillStoreModalContent />
    </SettingsPageWrapper>
  );
};

export default SkillStoreSettings;
