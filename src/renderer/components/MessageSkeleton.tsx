/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * MessageSkeleton - Skeleton loading state for chat messages
 *
 * Psychology: Skeleton screens turn passive waiting into active waiting,
 * reducing perceived load time by up to 50%. The pulsing animation
 * indicates activity without the anxiety-inducing spinner.
 *
 * Design: Mirrors the actual message structure so the UI feels stable
 * when content loads in.
 */

interface MessageSkeletonProps {
  /** Position of the message (left = AI, right = user) */
  position?: 'left' | 'right';
  /** Number of text lines to show */
  lines?: number;
  /** Whether to show the avatar placeholder */
  showAvatar?: boolean;
}

const MessageSkeleton: React.FC<MessageSkeletonProps> = ({ position = 'left', lines = 3, showAvatar = true }) => {
  const isRight = position === 'right';

  return (
    <div className={`flex gap-12px ${isRight ? 'flex-row-reverse' : 'flex-row'} py-8px animate-pulse`}>
      {/* Avatar placeholder */}
      {showAvatar && <div className='w-32px h-32px rd-full bg-fill-3 flex-shrink-0' />}

      {/* Content placeholder */}
      <div className={`flex flex-col gap-8px ${isRight ? 'items-end' : 'items-start'} flex-1 max-w-80%`}>
        {/* Message bubble */}
        <div className={`flex flex-col gap-6px p-12px rd-12px ${isRight ? 'bg-primary-1' : 'bg-fill-2'} w-full max-w-400px`}>
          {/* Simulate text lines with varying widths */}
          {Array.from({ length: lines }).map((_, index) => {
            // Vary the width of each line for a more natural look
            const widthPercent = index === lines - 1 ? 60 : index === 0 ? 90 : 75 + Math.random() * 20;

            return <div key={index} className='h-14px bg-fill-3 rd-4px' style={{ width: `${widthPercent}%` }} />;
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * MessageSkeletonGroup - Multiple skeleton messages for initial load
 */
export const MessageSkeletonGroup: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className='flex flex-col gap-16px p-16px'>
      {Array.from({ length: count }).map((_, index) => (
        <MessageSkeleton key={index} position={index % 2 === 0 ? 'left' : 'right'} lines={index === 0 ? 4 : index === 1 ? 2 : 3} />
      ))}
    </div>
  );
};

/**
 * ToolCallSkeleton - Skeleton for tool operation cards
 */
export const ToolCallSkeleton: React.FC = () => {
  return (
    <div className='animate-pulse p-12px rd-8px bg-fill-2 flex items-center gap-12px'>
      {/* Status indicator */}
      <div className='w-16px h-16px rd-full bg-fill-3' />

      {/* Tool name and description */}
      <div className='flex flex-col gap-6px flex-1'>
        <div className='h-14px w-80px bg-fill-3 rd-4px' />
        <div className='h-12px w-60% bg-fill-3 rd-4px' />
      </div>

      {/* Action area */}
      <div className='w-60px h-24px bg-fill-3 rd-4px' />
    </div>
  );
};

/**
 * ThinkingSkeleton - Skeleton for the "thinking" indicator
 */
export const ThinkingSkeleton: React.FC = () => {
  return (
    <div className='animate-pulse flex items-center gap-10px px-12px py-12px rd-16px bg-fill-2'>
      {/* Spinner placeholder */}
      <div className='w-16px h-16px rd-full bg-fill-3' />

      {/* Text placeholder */}
      <div className='h-14px w-100px bg-fill-3 rd-4px' />

      {/* Timer placeholder */}
      <div className='ml-auto h-12px w-60px bg-fill-3 rd-4px' />
    </div>
  );
};

export default MessageSkeleton;
