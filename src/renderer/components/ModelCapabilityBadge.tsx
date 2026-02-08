/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, Tag } from '@arco-design/web-react';
import { Brain, Eyes, Tool, Search, Cpu, Lightning, Pic } from '@icon-park/react';
import type { ModelType } from '@/common/storage';

interface ModelCapability {
  type: ModelType;
  icon: React.ReactNode;
  labelKey: string;
  color: string;
}

const CAPABILITY_CONFIG: ModelCapability[] = [
  { type: 'reasoning', icon: <Brain size={12} />, labelKey: 'models.capabilities.reasoning', color: 'purple' },
  { type: 'vision', icon: <Eyes size={12} />, labelKey: 'models.capabilities.vision', color: 'blue' },
  { type: 'function_calling', icon: <Tool size={12} />, labelKey: 'models.capabilities.toolUse', color: 'green' },
  { type: 'web_search', icon: <Search size={12} />, labelKey: 'models.capabilities.webSearch', color: 'orange' },
  { type: 'image_generation', icon: <Pic size={12} />, labelKey: 'models.capabilities.imageGen', color: 'magenta' },
];

export interface ModelCapabilityBadgeProps {
  /** Model name to display */
  modelName: string;
  /** Platform/provider name */
  platform?: string;
  /** Active capabilities for this model */
  capabilities?: ModelType[];
  /** Context window size in tokens */
  contextWindow?: number;
  /** Whether to show compact view */
  compact?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Displays model name with capability badges
 * Shows available features like reasoning, vision, tool use, etc.
 */
const ModelCapabilityBadge: React.FC<ModelCapabilityBadgeProps> = ({ modelName, platform, capabilities = [], contextWindow, compact = false, className = '' }) => {
  const { t } = useTranslation();

  const activeCapabilities = useMemo(() => {
    return CAPABILITY_CONFIG.filter((cap) => capabilities.includes(cap.type));
  }, [capabilities]);

  const contextDisplay = useMemo(() => {
    if (!contextWindow) return null;
    if (contextWindow >= 1_000_000) {
      return `${(contextWindow / 1_000_000).toFixed(0)}M`;
    }
    if (contextWindow >= 1_000) {
      return `${(contextWindow / 1_000).toFixed(0)}K`;
    }
    return contextWindow.toString();
  }, [contextWindow]);

  if (compact) {
    // Compact: just icons with tooltip
    return (
      <div className={`flex items-center gap-4px ${className}`}>
        <span className='text-12px text-t-secondary font-medium'>{modelName}</span>
        {activeCapabilities.length > 0 && (
          <Tooltip
            content={
              <div className='flex flex-col gap-2px'>
                {activeCapabilities.map((cap) => (
                  <span key={cap.type}>{t(cap.labelKey, cap.type)}</span>
                ))}
              </div>
            }
          >
            <div className='flex items-center gap-2px'>
              {activeCapabilities.slice(0, 3).map((cap) => (
                <span key={cap.type} className='text-t-tertiary'>
                  {cap.icon}
                </span>
              ))}
              {activeCapabilities.length > 3 && <span className='text-10px text-t-tertiary'>+{activeCapabilities.length - 3}</span>}
            </div>
          </Tooltip>
        )}
      </div>
    );
  }

  // Full view with labels
  return (
    <div className={`flex flex-col gap-4px ${className}`}>
      <div className='flex items-center gap-6px'>
        {platform && <Cpu size={14} className='text-t-secondary' />}
        <span className='text-14px font-medium text-t-primary'>{modelName}</span>
      </div>
      <div className='flex items-center gap-4px flex-wrap'>
        {activeCapabilities.map((cap) => (
          <Tag key={cap.type} size='small' color={cap.color} className='flex items-center gap-2px'>
            {cap.icon}
            <span className='text-10px'>{t(cap.labelKey, cap.type)}</span>
          </Tag>
        ))}
        {contextDisplay && (
          <Tag size='small' color='gray' className='flex items-center gap-2px'>
            <Lightning size={10} />
            <span className='text-10px'>{contextDisplay} context</span>
          </Tag>
        )}
      </div>
    </div>
  );
};

export default ModelCapabilityBadge;
