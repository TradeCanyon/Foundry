/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

interface ConfidenceBadgeProps {
  /** Confidence level */
  level: ConfidenceLevel;
  /** Number of sources (optional) */
  sourceCount?: number;
  /** Whether to show the confidence label */
  showLabel?: boolean;
  /** Additional class names */
  className?: string;
}

const CONFIDENCE_STYLES: Record<ConfidenceLevel, { bg: string; text: string; icon: string }> = {
  high: {
    bg: 'bg-[#dcfce7]',
    text: 'text-[#16a34a]',
    icon: '✓',
  },
  medium: {
    bg: 'bg-[#fef3c7]',
    text: 'text-[#d97706]',
    icon: '~',
  },
  low: {
    bg: 'bg-fill-2',
    text: 'text-t-secondary',
    icon: '?',
  },
};

// Dark mode overrides
const CONFIDENCE_STYLES_DARK: Record<ConfidenceLevel, { bg: string; text: string }> = {
  high: {
    bg: 'dark:bg-[#166534]/20',
    text: 'dark:text-[#4ade80]',
  },
  medium: {
    bg: 'dark:bg-[#92400e]/20',
    text: 'dark:text-[#fbbf24]',
  },
  low: {
    bg: 'dark:bg-fill-2',
    text: 'dark:text-t-secondary',
  },
};

/**
 * Derive confidence level from source count.
 * - High: 5+ sources
 * - Medium: 3-4 sources
 * - Low: <3 sources
 */
export const getConfidenceFromSources = (count: number): ConfidenceLevel => {
  if (count >= 5) return 'high';
  if (count >= 3) return 'medium';
  return 'low';
};

/**
 * Badge component to display AI confidence level.
 * Uses traffic-light color coding (green/orange/neutral).
 */
const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ level, sourceCount, showLabel = true, className }) => {
  const { t } = useTranslation();
  const style = CONFIDENCE_STYLES[level];
  const darkStyle = CONFIDENCE_STYLES_DARK[level];

  return (
    <div className={classNames('inline-flex items-center gap-4px px-8px py-2px rd-full text-12px font-medium', style.bg, style.text, darkStyle.bg, darkStyle.text, className)}>
      <span>{style.icon}</span>
      {sourceCount !== undefined && (
        <span>
          {sourceCount} {t('confidence.sources', { defaultValue: 'sources' })}
        </span>
      )}
      {showLabel && !sourceCount && <span>{t(`confidence.${level}`, { defaultValue: level })}</span>}
    </div>
  );
};

export default ConfidenceBadge;
