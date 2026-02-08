/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Spin } from '@arco-design/web-react';

// Fun, friendly verbs to show while waiting
const THINKING_PHRASES = ['Thinking', 'Pondering', 'Contemplating', 'Brewing ideas', 'Churning neurons', 'Crunching thoughts', 'Spinning up', 'Warming up', 'Getting creative', 'Cooking up', 'Conjuring', 'Summoning wisdom', 'Channeling', 'Percolating', 'Crystallizing'];

// Longer wait phrases (shown after 5+ seconds)
const LONGER_WAIT_PHRASES = ['Still thinking', 'Almost there', 'Deep in thought', 'Crafting response', 'Working on it', 'Bear with me', 'Processing', 'Nearly ready'];

export interface ThinkingIndicatorProps {
  /** Whether to show the indicator */
  visible: boolean;
  /** Optional custom message override */
  message?: string;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Show elapsed time */
  showTime?: boolean;
}

/**
 * Engaging thinking indicator that shows friendly status messages
 * while waiting for AI response
 */
const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ visible, message, size = 'medium', showTime = true }) => {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [dotCount, setDotCount] = useState(1);

  // Pick a random starting phrase
  useEffect(() => {
    if (visible) {
      setPhraseIndex(Math.floor(Math.random() * THINKING_PHRASES.length));
      setElapsedSeconds(0);
    }
  }, [visible]);

  // Rotate phrases every 3 seconds
  useEffect(() => {
    if (!visible) return;

    const phraseInterval = setInterval(() => {
      const phrases = elapsedSeconds > 5 ? LONGER_WAIT_PHRASES : THINKING_PHRASES;
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, 3000);

    return () => clearInterval(phraseInterval);
  }, [visible, elapsedSeconds]);

  // Track elapsed time
  useEffect(() => {
    if (!visible) return;

    const timeInterval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timeInterval);
  }, [visible]);

  // Animate dots
  useEffect(() => {
    if (!visible) return;

    const dotInterval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 400);

    return () => clearInterval(dotInterval);
  }, [visible]);

  const currentPhrase = useMemo(() => {
    if (message) return message;
    const phrases = elapsedSeconds > 5 ? LONGER_WAIT_PHRASES : THINKING_PHRASES;
    return phrases[phraseIndex % phrases.length];
  }, [message, phraseIndex, elapsedSeconds]);

  const dots = '.'.repeat(dotCount);

  const sizeClasses = {
    small: 'text-12px py-8px px-12px',
    medium: 'text-14px py-12px px-16px',
    large: 'text-16px py-16px px-20px',
  };

  const spinSize = {
    small: 12,
    medium: 16,
    large: 20,
  };

  if (!visible) return null;

  return (
    <div className={`flex items-center gap-12px ${sizeClasses[size]} bg-fill-1 rd-12px animate-fade-in`}>
      <Spin size={spinSize[size]} />
      <span className='text-t-secondary font-medium'>
        {currentPhrase}
        <span className='inline-block w-20px text-left'>{dots}</span>
      </span>
      {showTime && elapsedSeconds > 2 && <span className='text-t-tertiary text-12px ml-auto'>{elapsedSeconds}s</span>}
    </div>
  );
};

export default ThinkingIndicator;
