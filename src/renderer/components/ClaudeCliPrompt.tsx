/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Claude CLI Installation Prompt
 *
 * Shows a non-intrusive prompt to install Claude Code CLI when:
 * - User has Anthropic API key configured
 * - Claude Code CLI is not installed
 * - Routing preference is 'auto'
 *
 * This helps users use their Claude subscription instead of API credits.
 */

import { ipcBridge } from '@/common';
import type { IClaudeRoutingStatus, ICliInstallInstructions } from '@/common/ipcBridge';
import { Alert, Button, Link, Message, Space, Typography } from '@arco-design/web-react';
import { Close, Copy, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ClaudeCliPromptProps {
  /** Called when user dismisses the prompt */
  onDismiss?: () => void;
  /** Show as compact inline banner */
  compact?: boolean;
}

export const ClaudeCliPrompt: React.FC<ClaudeCliPromptProps> = ({ onDismiss, compact = false }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [instructions, setInstructions] = useState<ICliInstallInstructions | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Check if we should show the prompt
  useEffect(() => {
    const checkShouldPrompt = async () => {
      try {
        const shouldPrompt = await ipcBridge.claudeRouting.shouldPromptInstall.invoke();
        if (shouldPrompt) {
          const instrs = await ipcBridge.claudeRouting.getInstallInstructions.invoke();
          setInstructions(instrs);
          setVisible(true);
        }
      } catch (error) {
        console.warn('[ClaudeCliPrompt] Failed to check prompt status:', error);
      }
    };

    void checkShouldPrompt();
  }, []);

  // Copy install command to clipboard
  const handleCopyCommand = useCallback(() => {
    if (instructions?.command) {
      void navigator.clipboard.writeText(instructions.command);
      Message.success(t('common.copySuccess', 'Copied!'));
    }
  }, [instructions, t]);

  // Re-check after user claims they installed
  const handleRecheck = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await ipcBridge.claudeRouting.redetect.invoke();
      if (result.success && result.data?.cliAvailable) {
        Message.success(t('claudeRouting.cliDetected', 'Claude Code CLI detected! Your subscription will be used.'));
        setVisible(false);
        onDismiss?.();
      } else {
        Message.warning(t('claudeRouting.cliNotFound', "Claude Code CLI not found. Please ensure it's installed and in your PATH."));
      }
    } catch (error) {
      Message.error(t('common.error', 'Error checking CLI status'));
    } finally {
      setIsChecking(false);
    }
  }, [onDismiss, t]);

  // Dismiss prompt
  const handleDismiss = useCallback(() => {
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!visible || !instructions) {
    return null;
  }

  if (compact) {
    return (
      <Alert
        type='info'
        closable
        onClose={handleDismiss}
        content={
          <div className='flex items-center justify-between gap-12px'>
            <span className='text-13px'>{t('claudeRouting.compactPrompt', 'Install Claude Code CLI to use your subscription instead of API credits')}</span>
            <Space size={8}>
              <Button size='mini' type='text' onClick={handleCopyCommand}>
                <Copy size={14} /> {instructions.command.split(' ')[0]}
              </Button>
              <Button size='mini' type='primary' loading={isChecking} onClick={handleRecheck}>
                <Refresh size={14} /> {t('claudeRouting.recheck', 'I installed it')}
              </Button>
            </Space>
          </div>
        }
      />
    );
  }

  return (
    <div className='bg-fill-2 rd-8px p-16px mb-16px relative'>
      <Button type='text' size='mini' className='absolute top-8px right-8px' icon={<Close size={14} />} onClick={handleDismiss} />

      <Typography.Title heading={6} className='m-b-8px'>
        {t('claudeRouting.promptTitle', 'Use Your Claude Subscription')}
      </Typography.Title>

      <Typography.Text className='block m-b-12px text-t-secondary'>{t('claudeRouting.promptDescription', 'You have an Anthropic API key configured, but API calls use separate prepaid credits. Install Claude Code CLI to use your Claude subscription instead.')}</Typography.Text>

      <div className='bg-fill-3 rd-4px p-12px m-b-12px font-mono text-13px flex items-center justify-between'>
        <code>{instructions.command}</code>
        <Button type='text' size='mini' icon={<Copy size={14} />} onClick={handleCopyCommand}>
          {t('common.copy', 'Copy')}
        </Button>
      </div>

      <div className='flex items-center justify-between'>
        <Link href={instructions.url} target='_blank' className='text-13px'>
          {t('claudeRouting.learnMore', 'Learn more about Claude Code')}
        </Link>

        <Space size={12}>
          <Button type='text' onClick={handleDismiss}>
            {t('claudeRouting.notNow', 'Not now')}
          </Button>
          <Button type='primary' loading={isChecking} onClick={handleRecheck}>
            <Refresh size={14} className='m-r-4px' />
            {t('claudeRouting.recheck', 'I installed it')}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default ClaudeCliPrompt;
