/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ConstitutionModalContent from '@/renderer/components/SettingsModal/contents/ConstitutionModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const ConstitutionSettings: React.FC = () => {
  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      <ConstitutionModalContent />
    </SettingsPageWrapper>
  );
};

export default ConstitutionSettings;
