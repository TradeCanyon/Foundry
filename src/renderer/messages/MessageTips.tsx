/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageTips } from '@/common/chatLib';
import { Attention, CheckOne, Refresh, Copy, Switch } from '@icon-park/react';
import { theme } from '@office-ai/platform';
import { Button, Dropdown, Menu, Message } from '@arco-design/web-react';
import classNames from 'classnames';
import React, { useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MarkdownView from '../components/Markdown';
import CollapsibleContent from '../components/CollapsibleContent';

const icon = {
  success: <CheckOne theme='filled' size='16' fill={theme.Color.FunctionalColor.success} className='m-t-2px' />,
  warning: <Attention theme='filled' size='16' strokeLinejoin='bevel' className='m-t-2px' fill={theme.Color.FunctionalColor.warn} />,
  error: <Attention theme='filled' size='16' strokeLinejoin='bevel' className='m-t-2px' fill={theme.Color.FunctionalColor.error} />,
};

/**
 * Error categorization for actionable guidance
 */
interface ErrorGuidance {
  severity: 'recoverable' | 'fatal' | 'warning';
  category: 'rate_limit' | 'network' | 'context' | 'auth' | 'billing' | 'server' | 'unknown';
  message: string;
  action?: string;
  showRetry: boolean;
  showModelSwitcher: boolean;
  showNewChat: boolean;
  retryDelay?: number; // seconds to wait before retry (for rate limits)
}

/**
 * Categorize error from content string
 */
function categorizeError(content: string, t: (key: string, options?: { defaultValue?: string } & Record<string, unknown>) => string): ErrorGuidance {
  const lowerContent = content.toLowerCase();

  // Rate limit errors (429)
  if (lowerContent.includes('rate limit') || lowerContent.includes('429') || lowerContent.includes('too many requests')) {
    return {
      severity: 'recoverable',
      category: 'rate_limit',
      message: t('connection.rateLimit', { defaultValue: 'Rate limit reached' }),
      action: t('errors.rateLimitAction', { defaultValue: 'Wait a moment or switch to another model' }),
      showRetry: true,
      showModelSwitcher: true,
      showNewChat: false,
      retryDelay: 45,
    };
  }

  // Network/connection errors
  if (lowerContent.includes('network') || lowerContent.includes('timeout') || lowerContent.includes('connection') || lowerContent.includes('econnrefused') || lowerContent.includes('fetch failed') || lowerContent.includes('socket hang up')) {
    return {
      severity: 'recoverable',
      category: 'network',
      message: t('connection.networkError', { defaultValue: 'Network error' }),
      action: t('errors.networkAction', { defaultValue: 'Check your connection and try again' }),
      showRetry: true,
      showModelSwitcher: false,
      showNewChat: false,
    };
  }

  // Context overflow errors
  if (lowerContent.includes('context') || lowerContent.includes('token limit') || lowerContent.includes('max_tokens') || lowerContent.includes('context window')) {
    return {
      severity: 'fatal',
      category: 'context',
      message: t('connection.contextOverflow', { defaultValue: 'Context limit exceeded' }),
      action: t('errors.contextAction', { defaultValue: 'Start a new conversation or summarize the current one' }),
      showRetry: false,
      showModelSwitcher: true,
      showNewChat: true,
    };
  }

  // Authentication errors
  if (lowerContent.includes('unauthorized') || lowerContent.includes('401') || lowerContent.includes('invalid api key') || lowerContent.includes('authentication')) {
    return {
      severity: 'fatal',
      category: 'auth',
      message: t('errors.authError', { defaultValue: 'Authentication failed' }),
      action: t('errors.authAction', { defaultValue: 'Check your API key in settings' }),
      showRetry: false,
      showModelSwitcher: false,
      showNewChat: false,
    };
  }

  // Billing/credit errors
  if (lowerContent.includes('credit balance') || lowerContent.includes('billing') || lowerContent.includes('purchase credits') || lowerContent.includes('insufficient funds') || lowerContent.includes('payment required') || lowerContent.includes('402')) {
    return {
      severity: 'fatal',
      category: 'billing',
      message: t('errors.billingError', { defaultValue: 'Insufficient API credits' }),
      action: t('errors.billingAction', { defaultValue: 'Add credits at console.anthropic.com/billing or use Claude Code CLI with your subscription' }),
      showRetry: false,
      showModelSwitcher: true,
      showNewChat: false,
    };
  }

  // Server errors (500, 502, 503, 504)
  if (lowerContent.includes('500') || lowerContent.includes('502') || lowerContent.includes('503') || lowerContent.includes('504') || lowerContent.includes('server error') || lowerContent.includes('internal error')) {
    return {
      severity: 'recoverable',
      category: 'server',
      message: t('errors.serverError', { defaultValue: 'Server error' }),
      action: t('errors.serverAction', { defaultValue: 'The service may be temporarily unavailable. Try again shortly.' }),
      showRetry: true,
      showModelSwitcher: true,
      showNewChat: false,
    };
  }

  // Default unknown error
  return {
    severity: 'warning',
    category: 'unknown',
    message: t('common.error', { defaultValue: 'Error' }),
    showRetry: true,
    showModelSwitcher: false,
    showNewChat: false,
  };
}

const useFormatContent = (content: string) => {
  return useMemo(() => {
    try {
      const json = JSON.parse(content);
      return {
        json: true,
        data: json,
      };
    } catch {
      return { data: content };
    }
  }, [content]);
};

export interface MessageTipsProps {
  message: IMessageTips;
  /** Callback when user clicks retry */
  onRetry?: () => void | Promise<void>;
  /** Callback when user selects a different model */
  onSwitchModel?: (modelId: string) => void;
  /** Callback when user clicks new chat */
  onNewChat?: () => void;
  /** Callback to continue from partial response */
  onContinue?: () => void;
  /** Partial response content (if any was saved before error) */
  partialResponse?: string;
  /** Available alternative models for switching */
  alternativeModels?: Array<{ id: string; name: string }>;
}

const MessageTips: React.FC<MessageTipsProps> = ({ message, onRetry, onSwitchModel, onNewChat, onContinue, partialResponse, alternativeModels = [] }) => {
  const { content, type } = message.content;
  const { json, data } = useFormatContent(content);
  const { t } = useTranslation();
  const [isRetrying, setIsRetrying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Categorize error for actionable guidance
  const errorGuidance = useMemo(() => {
    if (type === 'error') {
      return categorizeError(content, t);
    }
    return null;
  }, [content, type, t]);

  // Handle structured error messages with error codes
  const getDisplayContent = (content: string): string => {
    // Try to extract message from API JSON errors like:
    // [API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance..."}}]
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        // Anthropic API error format
        if (parsed.error?.message) {
          return parsed.error.message;
        }
        // OpenAI API error format
        if (parsed.message) {
          return parsed.message;
        }
        // Generic error with type
        if (parsed.error?.type) {
          return `${parsed.error.type}: ${parsed.error.message || 'Unknown error'}`;
        }
      } catch {
        // Not valid JSON, continue with other parsing
      }
    }

    // Handle [API Error: XXX ...] prefix
    const apiErrorMatch = content.match(/^\[API Error: \d+\s*/);
    if (apiErrorMatch) {
      const remaining = content.slice(apiErrorMatch[0].length).replace(/\]$/, '');
      // If we already extracted JSON above, use that; otherwise show cleaned version
      return remaining || content;
    }

    if (content.startsWith('ERROR_')) {
      const parts = content.split(': ');
      const errorCode = parts[0].replace('ERROR_', '');
      const originalMessage = parts[1] || '';

      // Map error codes to i18n keys
      const errorMap: Record<string, string> = {
        CLOUDFLARE_BLOCKED: 'codex.network.cloudflare_blocked',
        NETWORK_TIMEOUT: 'codex.network.network_timeout',
        CONNECTION_REFUSED: 'codex.network.connection_refused',
        SESSION_TIMEOUT: 'codex.error.session_timeout',
        SYSTEM_INIT_FAILED: 'codex.error.system_init_failed',
        INVALID_MESSAGE_FORMAT: 'codex.error.invalid_message_format',
        INVALID_INPUT: 'codex.error.invalid_input',
        PERMISSION_DENIED: 'codex.error.permission_denied',
      };

      const i18nKey = errorMap[errorCode];
      if (i18nKey) {
        return t(i18nKey, { defaultValue: originalMessage });
      }
    }
    return content;
  };

  const displayContent = getDisplayContent(content);

  // Handle retry with optional countdown
  const handleRetry = useCallback(() => {
    if (!onRetry) return;

    const doRetry = async () => {
      if (errorGuidance?.retryDelay) {
        // Start countdown
        setCountdown(errorGuidance.retryDelay);
        const interval = setInterval(() => {
          setCountdown((prev) => {
            if (prev === null || prev <= 1) {
              clearInterval(interval);
              return null;
            }
            return prev - 1;
          });
        }, 1000);

        // Wait for countdown to complete before retrying
        await new Promise((resolve) => setTimeout(resolve, errorGuidance.retryDelay * 1000));
      }

      setIsRetrying(true);
      try {
        await onRetry();
      } finally {
        setIsRetrying(false);
      }
    };

    void doRetry();
  }, [onRetry, errorGuidance?.retryDelay]);

  // Copy error to clipboard
  const handleCopyError = useCallback(() => {
    void navigator.clipboard.writeText(content);
    Message.success(t('common.copySuccess', 'Copied'));
  }, [content, t]);

  // Render model switcher dropdown
  const renderModelSwitcher = () => {
    if (!errorGuidance?.showModelSwitcher || alternativeModels.length === 0 || !onSwitchModel) {
      return null;
    }

    return (
      <Dropdown
        droplist={
          <Menu>
            {alternativeModels.map((model) => (
              <Menu.Item key={model.id} onClick={() => onSwitchModel(model.id)}>
                {model.name}
              </Menu.Item>
            ))}
          </Menu>
        }
        trigger='click'
      >
        <Button size='mini' type='text' icon={<Switch size={12} />}>
          {t('errors.switchModel', 'Switch model')}
        </Button>
      </Dropdown>
    );
  };

  // Render action buttons for errors
  const renderErrorActions = () => {
    if (!errorGuidance || type !== 'error') return null;

    return (
      <div className='flex items-center gap-8px mt-8px flex-wrap'>
        {/* Retry button */}
        {errorGuidance.showRetry && onRetry && (
          <Button size='mini' type='outline' icon={<Refresh size={12} />} loading={isRetrying} disabled={countdown !== null} onClick={handleRetry}>
            {countdown !== null ? t('connection.rateLimitWaiting', 'Waiting {{seconds}}s...', { seconds: countdown }) : t('common.retry', 'Retry')}
          </Button>
        )}

        {/* Model switcher */}
        {renderModelSwitcher()}

        {/* Continue from partial response */}
        {onContinue && partialResponse && (
          <Button size='mini' type='outline' onClick={onContinue}>
            {t('errors.continueFromHere', 'Continue from here')}
          </Button>
        )}

        {/* New chat button */}
        {errorGuidance.showNewChat && onNewChat && (
          <Button size='mini' type='text' onClick={onNewChat}>
            {t('errors.newChat', 'New chat')}
          </Button>
        )}

        {/* Copy error */}
        <Button size='mini' type='text' icon={<Copy size={12} />} onClick={handleCopyError}>
          {t('errors.copyError', 'Copy error')}
        </Button>
      </div>
    );
  };

  if (json)
    return (
      <div className=' p-x-12px p-y-8px w-full max-w-100% min-w-0'>
        <CollapsibleContent maxHeight={300} defaultCollapsed={true}>
          <MarkdownView>{`\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``}</MarkdownView>
        </CollapsibleContent>
      </div>
    );

  return (
    <div className={classNames('bg-message-tips rd-8px p-x-12px p-y-8px')}>
      <div className='flex items-start gap-4px'>
        {icon[type] || icon.warning}
        <div className='flex-1 min-w-0'>
          <CollapsibleContent maxHeight={120} defaultCollapsed={true} useMask={false}>
            {/* Note: dangerouslySetInnerHTML is used here for existing functionality.
                Content comes from internal error messages, not user input.
                TODO: Consider using a sanitization library like DOMPurify for additional safety. */}
            <span
              className='whitespace-break-spaces text-t-primary [word-break:break-word]'
              dangerouslySetInnerHTML={{
                __html: displayContent,
              }}
            />
          </CollapsibleContent>

          {/* Action guidance for errors */}
          {errorGuidance?.action && <div className='text-12px text-t-secondary mt-4px'>{errorGuidance.action}</div>}

          {/* Action buttons */}
          {renderErrorActions()}
        </div>
      </div>
    </div>
  );
};

export default MessageTips;
