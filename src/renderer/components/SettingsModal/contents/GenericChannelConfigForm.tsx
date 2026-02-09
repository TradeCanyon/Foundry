/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * GenericChannelConfigForm — Reusable config form for channel adapters.
 * Handles token input, connection testing, and enable/disable for any channel.
 */

import type { IChannelPluginStatus } from '@/channels/types';
import { channel } from '@/common/ipcBridge';
import { Button, Input, Message } from '@arco-design/web-react';
import React, { useCallback, useState } from 'react';

interface FieldConfig {
  key: 'token' | 'appId';
  label: string;
  placeholder: string;
  type?: 'password' | 'text';
  description?: string;
}

interface GenericChannelConfigFormProps {
  pluginId: string;
  channelName: string;
  fields: FieldConfig[];
  setupInstructions?: React.ReactNode;
  pluginStatus: IChannelPluginStatus | null;
  onStatusChange: (status: IChannelPluginStatus | null) => void;
}

const PreferenceRow: React.FC<{
  label: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, description, children }) => (
  <div className='flex items-center justify-between gap-24px py-10px'>
    <div className='flex-1'>
      <span className='text-14px text-t-primary'>{label}</span>
      {description && <div className='text-12px text-t-tertiary mt-2px'>{description}</div>}
    </div>
    <div className='flex items-center'>{children}</div>
  </div>
);

const GenericChannelConfigForm: React.FC<GenericChannelConfigFormProps> = ({ pluginId, channelName, fields, setupInstructions, pluginStatus, onStatusChange }) => {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);

  const updateField = useCallback((key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleTest = useCallback(async () => {
    const token = fieldValues['token'] || '';
    if (!token && fields.some((f) => f.key === 'token')) {
      Message.warning(`Please enter the ${channelName} token first`);
      return;
    }

    setTesting(true);
    try {
      const extraConfig: Record<string, string> = {};
      if (fieldValues['appId']) {
        extraConfig.appId = fieldValues['appId'];
      }

      const result = await channel.testPlugin.invoke({
        pluginId,
        token,
        extraConfig: Object.keys(extraConfig).length > 0 ? extraConfig : undefined,
      });

      if (result.success && result.data?.success) {
        Message.success(`${channelName} connection successful${result.data.botUsername ? ` (${result.data.botUsername})` : ''}`);

        // Auto-enable after successful test
        const enableConfig: Record<string, unknown> = { token };
        if (fieldValues['appId']) {
          enableConfig.appId = fieldValues['appId'];
        }

        const enableResult = await channel.enablePlugin.invoke({
          pluginId,
          config: enableConfig,
        });

        if (enableResult.success) {
          Message.success(`${channelName} enabled`);
          // Refresh status
          const statusResult = await channel.getPluginStatus.invoke();
          if (statusResult.success && statusResult.data) {
            const updated = statusResult.data.find((p) => p.id === pluginId);
            onStatusChange(updated || null);
          }
        }
      } else {
        Message.error(result.data?.error || `Failed to connect to ${channelName}`);
      }
    } catch (error) {
      Message.error(`Connection test failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTesting(false);
    }
  }, [fieldValues, fields, pluginId, channelName, onStatusChange]);

  const isConnected = pluginStatus?.connected || false;

  return (
    <div className='flex flex-col gap-4px'>
      {setupInstructions && <div className='text-12px text-t-tertiary mb-8px'>{setupInstructions}</div>}

      {/* Status indicator */}
      {pluginStatus && (
        <PreferenceRow label='Status'>
          <div className='flex items-center gap-6px'>
            <div
              className='w-8px h-8px rd-full'
              style={{
                backgroundColor: isConnected ? '#52c41a' : pluginStatus.enabled ? '#faad14' : 'var(--text-tertiary)',
              }}
            />
            <span className='text-13px text-t-secondary'>{isConnected ? 'Connected' : pluginStatus.enabled ? 'Disconnected' : 'Not configured'}</span>
            {pluginStatus.botUsername && <span className='text-12px text-t-tertiary'>({pluginStatus.botUsername})</span>}
          </div>
        </PreferenceRow>
      )}

      {/* Credential fields */}
      {fields.map((field) => (
        <PreferenceRow key={field.key} label={field.label} description={field.description}>
          <div className='w-280px'>{field.type === 'password' ? <Input.Password size='small' placeholder={field.placeholder} value={fieldValues[field.key] || ''} onChange={(v) => updateField(field.key, v)} visibilityToggle /> : <Input size='small' placeholder={field.placeholder} value={fieldValues[field.key] || ''} onChange={(v) => updateField(field.key, v)} />}</div>
        </PreferenceRow>
      ))}

      {/* Test & Connect button */}
      <div className='flex justify-end mt-8px'>
        <Button type='primary' size='small' loading={testing} onClick={() => void handleTest()}>
          {pluginStatus?.hasToken ? 'Reconnect' : 'Test & Connect'}
        </Button>
      </div>
    </div>
  );
};

export default GenericChannelConfigForm;
