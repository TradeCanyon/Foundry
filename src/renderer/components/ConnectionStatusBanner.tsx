/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button, Spin } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { useThemeContext } from '@/renderer/context/ThemeContext';

/**
 * Connection state enum - mirrors streamResilience.ts
 */
export enum ConnectionState {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

export interface ConnectionStatusBannerProps {
  /** Current connection state */
  state: ConnectionState;
  /** Retry callback when user clicks retry button */
  onRetry?: () => void;
  /** Number of reconnection attempts (for RECONNECTING state) */
  reconnectAttempt?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Error message (for FAILED state) */
  errorMessage?: string;
  /** Auto-dismiss delay in ms after successful connection (default: 2000) */
  autoDismissDelay?: number;
  /** Additional CSS class */
  className?: string;
}

/**
 * ConnectionStatusBanner - Displays connection state to build user trust
 *
 * Shows:
 * - CONNECTING: "Connecting to [model]..." with pulsing indicator
 * - CONNECTED: Hidden (success is implicit) - auto-dismisses
 * - RECONNECTING: "Reconnecting (attempt 2/3)..." with warning style
 * - FAILED: "Connection lost" with error style and retry button
 */
const ConnectionStatusBanner: React.FC<ConnectionStatusBannerProps> = ({ state, onRetry, reconnectAttempt = 1, maxReconnectAttempts = 3, errorMessage, autoDismissDelay = 2000, className = '' }) => {
  const { t } = useTranslation();
  const { theme } = useThemeContext();
  const [isVisible, setIsVisible] = useState(false);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle visibility based on state
  useEffect(() => {
    // Clear any existing dismiss timer
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    if (state === ConnectionState.IDLE) {
      setIsVisible(false);
    } else if (state === ConnectionState.CONNECTED) {
      // Keep visible briefly then auto-dismiss
      setIsVisible(true);
      dismissTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, autoDismissDelay);
    } else {
      // CONNECTING, RECONNECTING, FAILED - show immediately
      setIsVisible(true);
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [state, autoDismissDelay]);

  const handleRetry = useCallback(() => {
    onRetry?.();
  }, [onRetry]);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Determine styles based on state and theme
  const getStateStyles = () => {
    const isDark = theme === 'dark';

    switch (state) {
      case ConnectionState.CONNECTING:
        return {
          background: isDark ? 'rgba(22, 93, 255, 0.15)' : 'rgba(22, 93, 255, 0.08)',
          borderColor: isDark ? 'rgba(22, 93, 255, 0.3)' : 'rgba(22, 93, 255, 0.2)',
          textColor: isDark ? 'rgb(var(--primary-5))' : 'rgb(var(--primary-6))',
          iconColor: 'rgb(var(--primary-6))',
        };
      case ConnectionState.CONNECTED:
        return {
          background: isDark ? 'rgba(0, 180, 42, 0.15)' : 'rgba(0, 180, 42, 0.08)',
          borderColor: isDark ? 'rgba(0, 180, 42, 0.3)' : 'rgba(0, 180, 42, 0.2)',
          textColor: isDark ? 'rgb(var(--success-5))' : 'rgb(var(--success-6))',
          iconColor: 'rgb(var(--success-6))',
        };
      case ConnectionState.RECONNECTING:
        return {
          background: isDark ? 'rgba(255, 125, 0, 0.15)' : 'rgba(255, 125, 0, 0.08)',
          borderColor: isDark ? 'rgba(255, 125, 0, 0.3)' : 'rgba(255, 125, 0, 0.2)',
          textColor: isDark ? 'rgb(var(--warning-5))' : 'rgb(var(--warning-6))',
          iconColor: 'rgb(var(--warning-6))',
        };
      case ConnectionState.FAILED:
        return {
          background: isDark ? 'rgba(245, 63, 63, 0.15)' : 'rgba(245, 63, 63, 0.08)',
          borderColor: isDark ? 'rgba(245, 63, 63, 0.3)' : 'rgba(245, 63, 63, 0.2)',
          textColor: isDark ? 'rgb(var(--danger-5))' : 'rgb(var(--danger-6))',
          iconColor: 'rgb(var(--danger-6))',
        };
      default:
        return {
          background: 'transparent',
          borderColor: 'transparent',
          textColor: 'inherit',
          iconColor: 'inherit',
        };
    }
  };

  const styles = getStateStyles();

  // Get status message
  const getMessage = () => {
    switch (state) {
      case ConnectionState.CONNECTING:
        return t('connection.connecting', 'Connecting...');
      case ConnectionState.CONNECTED:
        return t('connection.connected', 'Connected');
      case ConnectionState.RECONNECTING:
        return t('connection.reconnecting', 'Reconnecting (attempt {{current}}/{{max}})...', {
          current: reconnectAttempt,
          max: maxReconnectAttempts,
        });
      case ConnectionState.FAILED:
        return errorMessage || t('connection.failed', 'Connection lost');
      default:
        return '';
    }
  };

  // Get status indicator
  const renderIndicator = () => {
    switch (state) {
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return <Spin size={12} />;
      case ConnectionState.CONNECTED:
        return <div className='w-8px h-8px rd-full' style={{ backgroundColor: styles.iconColor }} />;
      case ConnectionState.FAILED:
        return <div className='w-8px h-8px rd-full' style={{ backgroundColor: styles.iconColor }} />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`connection-status-banner flex items-center justify-center gap-8px px-12px py-6px text-12px transition-all duration-300 ${className}`}
      style={{
        background: styles.background,
        borderBottom: `1px solid ${styles.borderColor}`,
        color: styles.textColor,
      }}
    >
      {renderIndicator()}
      <span>{getMessage()}</span>
      {state === ConnectionState.FAILED && onRetry && (
        <Button size='mini' type='text' onClick={handleRetry} className='ml-8px' style={{ color: styles.textColor }}>
          {t('common.retry', 'Retry')}
        </Button>
      )}
    </div>
  );
};

export default ConnectionStatusBanner;
