/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CodexToolCallUpdate } from '@/common/chatLib';
import ConfidenceBadge, { getConfidenceFromSources } from '@/renderer/components/ConfidenceBadge';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import BaseToolCallDisplay from './BaseToolCallDisplay';

type WebSearchUpdate = Extract<CodexToolCallUpdate, { subtype: 'web_search_begin' | 'web_search_end' }>;

const WebSearchDisplay: React.FC<{ content: WebSearchUpdate }> = ({ content }) => {
  const { toolCallId, title, status, description, subtype, data } = content;
  const { t } = useTranslation();

  // Extract source count from search results
  const sourceCount = useMemo(() => {
    if (subtype === 'web_search_end' && data) {
      // Check for results array in various possible locations
      if ('results' in data && Array.isArray(data.results)) {
        return data.results.length;
      }
      // Sometimes results come as a count
      if ('resultCount' in data && typeof data.resultCount === 'number') {
        return data.resultCount;
      }
    }
    return 0;
  }, [data, subtype]);

  const confidenceLevel = getConfidenceFromSources(sourceCount);

  const getDisplayTitle = () => {
    if (title) return title;

    switch (subtype) {
      case 'web_search_begin':
        return t('tools.titles.web_search_started');
      case 'web_search_end':
        return 'query' in data && data.query ? `${t('tools.titles.web_search')}: ${data.query}` : t('tools.titles.web_search_completed');
      default:
        return t('tools.titles.web_search');
    }
  };

  return (
    <BaseToolCallDisplay toolCallId={toolCallId} title={getDisplayTitle()} status={status} description={description} icon='🔍'>
      {/* Display query if available */}
      {subtype === 'web_search_end' && 'query' in data && data.query && (
        <div className='text-sm mb-2'>
          <div className='text-xs text-t-secondary mb-1'>{t('tools.labels.search_query')}</div>
          <div className='bg-1 p-2 rounded text-sm border border-b-base'>
            <span className='text-primary font-medium'>{data.query}</span>
          </div>
        </div>
      )}

      {/* Confidence indicator based on source count */}
      {subtype === 'web_search_end' && sourceCount > 0 && (
        <div className='flex items-center gap-8px mt-8px'>
          <ConfidenceBadge level={confidenceLevel} sourceCount={sourceCount} showLabel={false} />
          <span className='text-11px text-t-tertiary'>
            {confidenceLevel === 'high' && t('confidence.well_sourced', { defaultValue: 'Well-sourced' })}
            {confidenceLevel === 'low' && t('confidence.verify_recommended', { defaultValue: 'Consider verifying' })}
          </span>
        </div>
      )}
    </BaseToolCallDisplay>
  );
};

export default WebSearchDisplay;
