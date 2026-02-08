/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import classNames from 'classnames';

interface MessageAvatarProps {
  /** Whether this is a user message (vs AI) */
  isUser: boolean;
  /** Optional custom initial for user */
  userInitial?: string;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Additional class names */
  className?: string;
}

const SIZE_CLASSES = {
  small: 'w-24px h-24px text-11px',
  medium: 'w-32px h-32px text-14px',
  large: 'w-40px h-40px text-16px',
};

/**
 * Avatar component for message sender identification.
 * Shows user initial for user messages, Foundry icon for AI messages.
 */
const MessageAvatar: React.FC<MessageAvatarProps> = ({ isUser, userInitial = 'U', size = 'medium', className }) => {
  if (isUser) {
    return (
      <div className={classNames('rd-full flex items-center justify-center flex-shrink-0 font-medium', 'bg-primary text-white', SIZE_CLASSES[size], className)} aria-label='User'>
        {userInitial.charAt(0).toUpperCase()}
      </div>
    );
  }

  // AI avatar with Foundry gradient
  return (
    <div
      className={classNames('rd-full flex items-center justify-center flex-shrink-0 font-medium', SIZE_CLASSES[size], className)}
      style={{
        background: 'linear-gradient(135deg, #ff6b35 0%, #f7c59f 100%)',
        color: 'white',
      }}
      aria-label='Foundry AI'
    >
      ✦
    </div>
  );
};

export default MessageAvatar;
