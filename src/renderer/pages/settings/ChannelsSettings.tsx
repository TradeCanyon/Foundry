/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ChannelModalContent from '@/renderer/components/SettingsModal/contents/ChannelModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const ChannelsSettings: React.FC = () => {
  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      <ChannelModalContent />
    </SettingsPageWrapper>
  );
};

export default ChannelsSettings;
