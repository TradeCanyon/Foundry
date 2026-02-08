/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Card, Tag } from '@arco-design/web-react';
import type { ReactNode } from 'react';
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Down, Up } from '@icon-park/react';

export const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();

  const getTagProps = () => {
    switch (status) {
      case 'pending':
        return { color: 'blue', text: t('tools.status.pending') };
      case 'executing':
        return { color: 'orange', text: t('tools.status.executing') };
      case 'success':
        return { color: 'green', text: t('tools.status.success') };
      case 'error':
        return { color: 'red', text: t('tools.status.error') };
      case 'canceled':
        return { color: 'gray', text: t('tools.status.canceled') };
      default:
        return { color: 'gray', text: status };
    }
  };

  const { color, text } = getTagProps();
  return <Tag color={color}>{text}</Tag>;
};

interface BaseToolCallDisplayProps {
  toolCallId: string;
  title: string;
  status: string;
  description?: string | ReactNode;
  icon: string;
  additionalTags?: ReactNode; // Additional tags such as exit code, duration, etc.
  children?: ReactNode; // Detailed content for specific tools
  /** Summary text shown when collapsed */
  summary?: string;
  /** Whether to enable collapsible details */
  collapsible?: boolean;
  /** Default collapsed state (default: true when collapsible) */
  defaultCollapsed?: boolean;
}

const BaseToolCallDisplay: React.FC<BaseToolCallDisplayProps> = ({ toolCallId, title, status, description, icon, additionalTags, children, summary, collapsible = false, defaultCollapsed = true }) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const showChildren = !collapsible || !isCollapsed;

  return (
    <Card className='w-full mb-2 foundry-card-lift' size='small' bordered>
      <div className='flex items-start gap-3'>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 mb-2'>
            <span className='text-lg'>{icon}</span>
            <span className='font-medium text-t-primary'>{title}</span>
            <StatusTag status={status} />
            {additionalTags}

            {/* Collapse toggle button */}
            {collapsible && (
              <button onClick={toggleCollapse} className='ml-auto flex items-center gap-4px text-12px text-t-tertiary hover:text-t-secondary cursor-pointer bg-transparent border-none p-0 foundry-press-scale transition-transform' type='button'>
                {isCollapsed ? (
                  <>
                    <span>{t('common.expandMore', 'Expand')}</span>
                    <Down size={12} className='transition-transform' />
                  </>
                ) : (
                  <>
                    <span>{t('common.collapse', 'Collapse')}</span>
                    <Up size={12} className='transition-transform' />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Summary when collapsed */}
          {collapsible && isCollapsed && summary && <div className='text-12px text-t-secondary mb-2'>{summary}</div>}

          {description && showChildren && <div className='text-sm text-t-secondary mb-2 overflow-hidden'>{description}</div>}

          {/* Tool-specific detailed information - only show when not collapsed */}
          {showChildren && children}

          <div className='text-xs text-t-secondary mt-2'>Tool Call ID: {toolCallId}</div>
        </div>
      </div>
    </Card>
  );
};

export default BaseToolCallDisplay;
