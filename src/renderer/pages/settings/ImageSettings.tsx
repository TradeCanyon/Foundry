/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ImageModalContent from '@/renderer/components/SettingsModal/contents/ImageModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const ImageSettings: React.FC = () => {
  return (
    <SettingsPageWrapper>
      <ImageModalContent />
    </SettingsPageWrapper>
  );
};

export default ImageSettings;
