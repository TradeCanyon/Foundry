/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tag, Spin } from '@arco-design/web-react';
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useThemeContext } from '@/renderer/context/ThemeContext';
import { useTranslation } from 'react-i18next';

export interface ThoughtData {
  subject: string;
  description: string;
}

export interface PhaseInfo {
  /** Phase name/label */
  name: string;
  /** Whether this phase is completed */
  completed?: boolean;
  /** Whether this phase is currently active */
  active?: boolean;
}

interface ThoughtDisplayProps {
  thought: ThoughtData;
  style?: 'default' | 'compact';
  running?: boolean;
  onStop?: () => void;
  /** Multi-phase operation tracking */
  phases?: PhaseInfo[];
  /** Current phase index (0-based) */
  currentPhase?: number;
}

// Background gradient constants
const GRADIENT_DARK = 'linear-gradient(135deg, #464767 0%, #323232 100%)';
const GRADIENT_LIGHT = 'linear-gradient(90deg, #F0F3FF 0%, #F2F2F2 100%)';

// Foundry-themed phrases inspired by metalworking/forging
// These create a memorable brand identity while the AI works
const FOUNDRY_PHRASES = {
  // General thinking phrases
  thinking: ['Forging thoughts', 'Heating up the logic', 'Tempering ideas', 'Smelting possibilities', 'Casting the approach', 'Hammering out details', 'Annealing the plan', 'Shaping the response', 'Molding concepts', 'Stoking the furnace', 'Refining the alloy', 'Working the metal'],
  // Reading/analyzing files
  reading: ['Inspecting the ore', 'Examining the metal', 'Scanning the blueprints', 'Assaying the codebase', 'Mining for context', 'Surveying the structure'],
  // Writing/creating files
  writing: ['Pouring the mold', 'Striking while hot', 'Forging the changes', 'Welding the pieces', 'Casting new code', 'Shaping the output'],
  // Searching
  searching: ['Prospecting', 'Sifting through the slag', 'Panning for gold', 'Surveying the mine', 'Extracting insights'],
  // Executing commands
  executing: ['Firing up the forge', 'Cranking the bellows', 'Striking the anvil', 'Applying heat treatment', 'Running the crucible'],
};

// Longer wait phrases (shown after 8+ seconds) - also Foundry-themed
const LONGER_WAIT_PHRASES = ['Still tempering', 'Almost forged', 'Deep in the furnace', 'Letting it cool', 'Final quench', 'Nearly cast', 'Polishing the finish'];

// All thinking phrases flattened for default random selection
const ALL_THINKING_PHRASES = FOUNDRY_PHRASES.thinking;

// Format elapsed time
const formatElapsedTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const ThoughtDisplay: React.FC<ThoughtDisplayProps> = ({ thought, style = 'default', running = false, onStop, phases, currentPhase }) => {
  const { theme } = useThemeContext();
  const { t } = useTranslation();
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [dotCount, setDotCount] = useState(1);

  // Timer for elapsed time
  useEffect(() => {
    if (!running && !thought?.subject) {
      setElapsedTime(0);
      return;
    }

    // Start new timer
    startTimeRef.current = Date.now();
    setElapsedTime(0);
    setPhraseIndex(Math.floor(Math.random() * ALL_THINKING_PHRASES.length));

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(timer);
  }, [running, thought?.subject]);

  // Rotate phrases every 2.5 seconds
  useEffect(() => {
    if (!running || thought?.subject) return;

    const phraseInterval = setInterval(() => {
      const phrases = elapsedTime > 8 ? LONGER_WAIT_PHRASES : ALL_THINKING_PHRASES;
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, 2500);

    return () => clearInterval(phraseInterval);
  }, [running, thought?.subject, elapsedTime]);

  // Animate dots
  useEffect(() => {
    if (!running) return;

    const dotInterval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 400);

    return () => clearInterval(dotInterval);
  }, [running]);

  // Handle ESC key to cancel
  useEffect(() => {
    if (!running || !onStop) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [running, onStop]);

  // Calculate final style based on theme and style prop
  const containerStyle = useMemo(() => {
    const background = theme === 'dark' ? GRADIENT_DARK : GRADIENT_LIGHT;

    if (style === 'compact') {
      return {
        background,
        marginBottom: '8px',
        maxHeight: '100px',
        overflow: 'scroll' as const,
      };
    }

    return {
      background,
      transform: 'translateY(36px)',
    };
  }, [theme, style]);

  // Don't show if no thought and not running
  if (!thought?.subject && !running) {
    return null;
  }

  // Get current thinking phrase
  const getCurrentPhrase = () => {
    const phrases = elapsedTime > 8 ? LONGER_WAIT_PHRASES : ALL_THINKING_PHRASES;
    return phrases[phraseIndex % phrases.length];
  };

  const dots = '.'.repeat(dotCount);

  // Show default processing state when running but no thought (with fun phrases!)
  if (running && !thought?.subject) {
    return (
      <div className='px-12px py-12px rd-16px text-14px pb-40px lh-20px text-t-primary flex items-center gap-10px' style={containerStyle}>
        <Spin size={16} />
        <span className='text-t-primary font-medium'>
          {getCurrentPhrase()}
          <span className='inline-block w-24px'>{dots}</span>
        </span>
        <span className='ml-auto text-t-tertiary text-12px whitespace-nowrap'>
          {formatElapsedTime(elapsedTime)} · {t('common.escToCancel')}
        </span>
      </div>
    );
  }

  // Calculate phase progress percentage
  const phaseProgress = phases && phases.length > 0 ? ((currentPhase ?? 0) / phases.length) * 100 : 0;
  const hasPhases = phases && phases.length > 1;

  return (
    <div className='px-10px py-10px rd-20px text-14px pb-40px lh-20px text-t-primary' style={containerStyle}>
      <div className='flex items-center gap-8px'>
        {running && <Spin size={14} />}
        <Tag color='arcoblue' size='small'>
          {thought.subject}
        </Tag>
        <span className='flex-1 truncate'>{thought.description}</span>
        {running && (
          <span className='text-t-tertiary text-12px whitespace-nowrap'>
            ({t('common.escToCancel')}, {formatElapsedTime(elapsedTime)})
          </span>
        )}
      </div>

      {/* Phase indicators for multi-step operations */}
      {hasPhases && (
        <div className='mt-8px'>
          {/* Progress bar */}
          <div className='flex items-center gap-8px mb-6px'>
            <span className='text-12px text-t-secondary'>
              {t('conversation.phases.step', 'Step')} {(currentPhase ?? 0) + 1}/{phases.length}
            </span>
            <div className='flex-1 h-4px bg-fill-3 rd-2px overflow-hidden'>
              <div className='h-full bg-primary-6 transition-all duration-300' style={{ width: `${phaseProgress}%` }} />
            </div>
          </div>

          {/* Phase list */}
          <div className='flex flex-col gap-2px text-12px'>
            {phases.map((phase, idx) => {
              const isActive = idx === (currentPhase ?? 0);
              const isCompleted = idx < (currentPhase ?? 0);
              const isPending = idx > (currentPhase ?? 0);

              return (
                <div key={idx} className={`flex items-center gap-6px ${isPending ? 'opacity-40' : ''}`}>
                  <span className='w-14px text-center'>{isCompleted ? <span className='text-success-6'>&#10003;</span> : isActive ? <span className='text-primary-6'>&#8594;</span> : <span className='text-t-tertiary'>&#9675;</span>}</span>
                  <span className={isActive ? 'text-t-primary font-medium' : 'text-t-secondary'}>{phase.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThoughtDisplay;
