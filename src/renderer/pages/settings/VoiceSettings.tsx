/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import VoiceModalContent from '@/renderer/components/SettingsModal/contents/VoiceModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const VoiceSettings: React.FC = () => {
  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      <VoiceModalContent />
    </SettingsPageWrapper>
  );
};

export default VoiceSettings;
