/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IChannelPluginStatus, PluginType } from '@/channels/types';
import { ipcBridge } from '@/common';
import { channel } from '@/common/ipcBridge';
import type { IProvider, TProviderWithModel } from '@/common/storage';
import { ConfigStorage } from '@/common/storage';
import { uuid } from '@/common/utils';
import FoundryScrollArea from '@/renderer/components/base/FoundryScrollArea';
import { useGeminiGoogleAuthModels } from '@/renderer/hooks/useGeminiGoogleAuthModels';
import { hasSpecificModelCapability } from '@/renderer/utils/modelCapabilities';
import { Message } from '@arco-design/web-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { useSettingsViewMode } from '../settingsViewContext';
import ChannelItem from './channels/ChannelItem';
import type { ChannelConfig } from './channels/types';
import GenericChannelConfigForm from './GenericChannelConfigForm';
import TelegramConfigForm from './TelegramConfigForm';

/**
 * Get available primary models for a provider (supports function calling)
 */
const getAvailableModels = (provider: IProvider): string[] => {
  const result: string[] = [];
  for (const modelName of provider.model || []) {
    const functionCalling = hasSpecificModelCapability(provider, modelName, 'function_calling');
    const excluded = hasSpecificModelCapability(provider, modelName, 'excludeFromPrimary');

    if ((functionCalling === true || functionCalling === undefined) && excluded !== true) {
      result.push(modelName);
    }
  }
  return result;
};

/**
 * Check if provider has available models
 */
const hasAvailableModels = (provider: IProvider): boolean => {
  return getAvailableModels(provider).length > 0;
};

/**
 * Hook to get available model list for channel
 */
const useChannelModelList = () => {
  const { geminiModeOptions, isGoogleAuth } = useGeminiGoogleAuthModels();
  const { data: modelConfig } = useSWR('model.config.assistant', () => {
    return ipcBridge.mode.getModelConfig.invoke().then((data: IProvider[]) => {
      return (data || []).filter((platform: IProvider) => !!platform.model.length);
    });
  });

  const geminiModelValues = useMemo(() => geminiModeOptions.map((option) => option.value), [geminiModeOptions]);

  const modelList = useMemo(() => {
    let allProviders: IProvider[] = [];

    if (isGoogleAuth) {
      const geminiProvider: IProvider = {
        id: uuid(),
        name: 'Gemini Google Auth',
        platform: 'gemini-with-google-auth',
        baseUrl: '',
        apiKey: '',
        model: geminiModelValues,
        capabilities: [{ type: 'text' }, { type: 'vision' }, { type: 'function_calling' }],
      };
      allProviders = [geminiProvider, ...(modelConfig || [])];
    } else {
      allProviders = modelConfig || [];
    }

    return allProviders.filter(hasAvailableModels);
  }, [geminiModelValues, isGoogleAuth, modelConfig]);

  return { modelList };
};

// ============================================================
// Setup Guide Component & Step Data
// ============================================================

type SetupStep = { title: string; detail: React.ReactNode };

const SetupGuide: React.FC<{ steps: SetupStep[] }> = ({ steps }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div className='text-13px text-brand cursor-pointer hover:underline select-none' onClick={() => setExpanded(!expanded)}>
        {expanded ? '\u25BC' : '\u25B6'} Setup Guide ({steps.length} steps)
      </div>
      {expanded && (
        <ol className='pl-20px mt-8px mb-0 text-13px text-t-secondary leading-relaxed space-y-6px'>
          {steps.map((step, i) => (
            <li key={i}>
              <span className='font-500 text-t-primary'>{step.title}</span>
              <br />
              <span>{step.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

const Link: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} target='_blank' rel='noopener noreferrer' className='text-brand'>
    {children}
  </a>
);
const B: React.FC<{ children: React.ReactNode }> = ({ children }) => <b>{children}</b>;
const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => <code className='text-12px bg-fill-2 px-4px py-1px rd-3px'>{children}</code>;

const DISCORD_SETUP_STEPS: SetupStep[] = [
  {
    title: 'Create Application',
    detail: (
      <>
        Go to <Link href='https://discord.com/developers/applications'>Discord Developer Portal</Link> and click "New Application".
      </>
    ),
  },
  {
    title: 'Add Bot',
    detail: (
      <>
        Go to the <B>Bot</B> tab, click "Add Bot", then copy the <B>Bot Token</B>.
      </>
    ),
  },
  {
    title: 'Enable Message Content Intent',
    detail: (
      <>
        In the Bot tab under Privileged Gateway Intents, toggle <B>Message Content Intent</B> ON.
      </>
    ),
  },
  {
    title: 'Generate Invite URL',
    detail: (
      <>
        Go to <B>OAuth2 &rarr; URL Generator</B>. Select scope: <Code>bot</Code>. Select permissions: <Code>Send Messages</Code>, <Code>Read Message History</Code>, <Code>View Channels</Code>.
      </>
    ),
  },
  { title: 'Invite Bot to Server', detail: 'Copy the generated URL and open it in your browser to invite the bot to your server.' },
  { title: 'Connect', detail: 'Paste the Bot Token above and click "Test & Connect".' },
  { title: 'Note', detail: "Keep your app Private. Use the URL Generator link from step 4 to invite the bot \u2014 you don't need a default authorization link." },
];

const SLACK_SETUP_STEPS: SetupStep[] = [
  {
    title: 'Create App',
    detail: (
      <>
        Go to <Link href='https://api.slack.com/apps'>api.slack.com/apps</Link> &rarr; "Create New App" &rarr; "From scratch".
      </>
    ),
  },
  {
    title: 'Enable Socket Mode',
    detail: (
      <>
        Go to <B>Settings &rarr; Socket Mode</B>, toggle ON. Create an App-Level Token with <Code>connections:write</Code> scope. Copy it (starts with <Code>xapp-</Code>).
      </>
    ),
  },
  {
    title: 'Add Bot Scopes',
    detail: (
      <>
        Go to <B>OAuth & Permissions</B> and add Bot Token Scopes: <Code>chat:write</Code>, <Code>app_mentions:read</Code>, <Code>im:history</Code>, <Code>im:read</Code>, <Code>im:write</Code>.
      </>
    ),
  },
  {
    title: 'Install to Workspace',
    detail: (
      <>
        Click <B>Install to Workspace</B> and authorize.
      </>
    ),
  },
  {
    title: 'Copy Bot Token',
    detail: (
      <>
        Copy the <B>Bot User OAuth Token</B> (starts with <Code>xoxb-</Code>) from the OAuth & Permissions page.
      </>
    ),
  },
  { title: 'Connect', detail: 'Paste both tokens above and click "Test & Connect".' },
];

const WHATSAPP_SETUP_STEPS: SetupStep[] = [
  { title: 'Start Pairing', detail: 'Click "Test & Connect" below to start the pairing process.' },
  { title: 'Scan QR Code', detail: 'A QR code will appear in your terminal/logs. Scan it with WhatsApp on your phone (Settings \u2192 Linked Devices \u2192 Link a Device).' },
  { title: 'Connected', detail: 'Once paired, Foundry will automatically connect.' },
  { title: 'Note', detail: 'WhatsApp Web connections can be unstable. If disconnected, click "Reconnect" to re-pair.' },
  {
    title: 'Requirement',
    detail: (
      <>
        Requires <Code>@whiskeysockets/baileys</Code> npm package. If not installed, run <Code>npm install @whiskeysockets/baileys</Code> in the Foundry directory.
      </>
    ),
  },
];

const SIGNAL_SETUP_STEPS: SetupStep[] = [
  {
    title: 'Run signal-cli-rest-api',
    detail: (
      <>
        Install and run <Link href='https://github.com/bbernhard/signal-cli-rest-api'>signal-cli-rest-api</Link> (Docker recommended: <Code>docker run -p 8080:8080 bbernhard/signal-cli-rest-api</Code>).
      </>
    ),
  },
  { title: 'Register Phone Number', detail: 'Register a phone number with signal-cli (see signal-cli docs).' },
  {
    title: 'Enter Credentials',
    detail: (
      <>
        Enter the registered phone number and API base URL (usually <Code>http://localhost:8080</Code>).
      </>
    ),
  },
  { title: 'Connect', detail: 'Click "Test & Connect".' },
  { title: 'Note (Advanced)', detail: 'This requires a dedicated phone number and a running signal-cli instance. Recommended for advanced users only.' },
];

/** Plugin IDs follow the {type}_default convention */
const PLUGIN_IDS: Record<PluginType, string> = {
  telegram: 'telegram_default',
  slack: 'slack_default',
  discord: 'discord_default',
  whatsapp: 'whatsapp_default',
  signal: 'signal_default',
};

/**
 * Channel Settings Content Component
 */
const ChannelModalContent: React.FC = () => {
  const { t } = useTranslation();
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  // Plugin status for ALL channels
  const [pluginStatuses, setPluginStatuses] = useState<Record<string, IChannelPluginStatus | null>>({});
  const [_loading, setLoading] = useState(false);
  const [enableLoading, setEnableLoading] = useState<Record<string, boolean>>({});

  // Collapse state — all collapsed by default
  const [collapseKeys, setCollapseKeys] = useState<Record<string, boolean>>({
    telegram: true,
    slack: true,
    discord: true,
    whatsapp: true,
    signal: true,
  });

  // Model selection state (for Telegram)
  const { modelList } = useChannelModelList();
  const [selectedModel, setSelectedModel] = useState<TProviderWithModel | null>(null);

  const getStatus = (type: PluginType) => pluginStatuses[type] || null;

  // Load ALL plugin statuses
  const loadPluginStatus = useCallback(async () => {
    setLoading(true);
    try {
      const result = await channel.getPluginStatus.invoke();
      if (result.success && result.data) {
        const statusMap: Record<string, IChannelPluginStatus | null> = {};
        for (const plugin of result.data) {
          statusMap[plugin.type] = plugin;
        }
        setPluginStatuses(statusMap);
      }
    } catch (error) {
      console.error('[ChannelSettings] Failed to load plugin status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadPluginStatus();
  }, [loadPluginStatus]);

  // Load saved model selection (Telegram)
  useEffect(() => {
    if (!modelList || modelList.length === 0) return;

    const loadSavedModel = async () => {
      try {
        const savedTelegramModel = await ConfigStorage.get('assistant.telegram.defaultModel');
        if (savedTelegramModel && savedTelegramModel.id && savedTelegramModel.useModel) {
          const provider = modelList.find((p) => p.id === savedTelegramModel.id);
          if (provider && provider.model?.includes(savedTelegramModel.useModel)) {
            setSelectedModel({ ...provider, useModel: savedTelegramModel.useModel });
          }
        }
      } catch (error) {
        console.error('[ChannelSettings] Failed to load saved model:', error);
      }
    };

    void loadSavedModel();
  }, [modelList]);

  // Listen for plugin status changes (ALL channels)
  useEffect(() => {
    const unsubscribe = channel.pluginStatusChanged.on(({ status }) => {
      setPluginStatuses((prev) => ({ ...prev, [status.type]: status }));
    });
    return () => unsubscribe();
  }, []);

  const handleToggleCollapse = (channelId: string) => {
    setCollapseKeys((prev) => ({
      ...prev,
      [channelId]: !prev[channelId],
    }));
  };

  const handleTogglePlugin = useCallback(
    async (pluginType: PluginType, enabled: boolean) => {
      const pluginId = PLUGIN_IDS[pluginType];
      setEnableLoading((prev) => ({ ...prev, [pluginType]: true }));
      try {
        if (enabled) {
          const status = getStatus(pluginType);
          if (!status?.hasToken) {
            Message.warning(t('settings.assistant.tokenRequired', 'Please configure credentials first'));
            setEnableLoading((prev) => ({ ...prev, [pluginType]: false }));
            return;
          }

          const result = await channel.enablePlugin.invoke({ pluginId, config: {} });
          if (result.success) {
            Message.success(`${pluginType} enabled`);
            await loadPluginStatus();
          } else {
            Message.error(result.msg || `Failed to enable ${pluginType}`);
          }
        } else {
          const result = await channel.disablePlugin.invoke({ pluginId });
          if (result.success) {
            Message.success(`${pluginType} disabled`);
            await loadPluginStatus();
          } else {
            Message.error(result.msg || `Failed to disable ${pluginType}`);
          }
        }
      } catch (error: any) {
        Message.error(error.message);
      } finally {
        setEnableLoading((prev) => ({ ...prev, [pluginType]: false }));
      }
    },
    [loadPluginStatus, pluginStatuses, t]
  );

  const handleStatusChange = useCallback((type: PluginType, status: IChannelPluginStatus | null) => {
    setPluginStatuses((prev) => ({ ...prev, [type]: status }));
  }, []);

  // Build channel configurations
  const channels: ChannelConfig[] = useMemo(() => {
    const telegramStatus = getStatus('telegram');
    const slackStatus = getStatus('slack');
    const discordStatus = getStatus('discord');
    const whatsappStatus = getStatus('whatsapp');
    const signalStatus = getStatus('signal');

    return [
      {
        id: 'telegram',
        title: t('channels.telegramTitle', 'Telegram'),
        description: t('channels.telegramDesc', 'Chat with Foundry assistant via Telegram'),
        status: 'active' as const,
        enabled: telegramStatus?.enabled || false,
        disabled: enableLoading['telegram'] || false,
        isConnected: telegramStatus?.connected || false,
        botUsername: telegramStatus?.botUsername,
        defaultModel: selectedModel?.useModel,
        content: <TelegramConfigForm pluginStatus={telegramStatus} modelList={modelList || []} selectedModel={selectedModel} onStatusChange={(s) => handleStatusChange('telegram', s)} onModelChange={setSelectedModel} />,
      },
      {
        id: 'discord',
        title: t('channels.discordTitle', 'Discord'),
        description: t('channels.discordDesc', 'Chat with Foundry assistant via Discord'),
        status: 'active' as const,
        enabled: discordStatus?.enabled || false,
        disabled: enableLoading['discord'] || false,
        isConnected: discordStatus?.connected || false,
        botUsername: discordStatus?.botUsername,
        content: <GenericChannelConfigForm pluginId={PLUGIN_IDS.discord} channelName='Discord' fields={[{ key: 'token', label: 'Bot Token', placeholder: 'Paste your Discord bot token', type: 'password' }]} setupInstructions={<SetupGuide steps={DISCORD_SETUP_STEPS} />} pluginStatus={discordStatus} onStatusChange={(s) => handleStatusChange('discord', s)} />,
      },
      {
        id: 'slack',
        title: t('channels.slackTitle', 'Slack'),
        description: t('channels.slackDesc', 'Chat with Foundry assistant via Slack'),
        status: 'active' as const,
        enabled: slackStatus?.enabled || false,
        disabled: enableLoading['slack'] || false,
        isConnected: slackStatus?.connected || false,
        botUsername: slackStatus?.botUsername,
        content: (
          <GenericChannelConfigForm
            pluginId={PLUGIN_IDS.slack}
            channelName='Slack'
            fields={[
              { key: 'token', label: 'Bot Token', placeholder: 'xoxb-...', type: 'password', description: 'Bot User OAuth Token from OAuth & Permissions' },
              { key: 'appId', label: 'App Token', placeholder: 'xapp-...', type: 'password', description: 'App-Level Token with connections:write scope' },
            ]}
            setupInstructions={<SetupGuide steps={SLACK_SETUP_STEPS} />}
            pluginStatus={slackStatus}
            onStatusChange={(s) => handleStatusChange('slack', s)}
          />
        ),
      },
      {
        id: 'whatsapp',
        title: t('channels.whatsappTitle', 'WhatsApp'),
        description: t('channels.whatsappDesc', 'Chat with Foundry assistant via WhatsApp'),
        status: 'active' as const,
        enabled: whatsappStatus?.enabled || false,
        disabled: enableLoading['whatsapp'] || false,
        isConnected: whatsappStatus?.connected || false,
        content: <GenericChannelConfigForm pluginId={PLUGIN_IDS.whatsapp} channelName='WhatsApp' fields={[]} setupInstructions={<SetupGuide steps={WHATSAPP_SETUP_STEPS} />} pluginStatus={whatsappStatus} onStatusChange={(s) => handleStatusChange('whatsapp', s)} />,
      },
      {
        id: 'signal',
        title: t('channels.signalTitle', 'Signal'),
        description: t('channels.signalDesc', 'Chat with Foundry assistant via Signal'),
        status: 'active' as const,
        enabled: signalStatus?.enabled || false,
        disabled: enableLoading['signal'] || false,
        isConnected: signalStatus?.connected || false,
        content: (
          <GenericChannelConfigForm
            pluginId={PLUGIN_IDS.signal}
            channelName='Signal'
            fields={[
              { key: 'token', label: 'Phone Number', placeholder: '+1234567890', description: 'The phone number registered with signal-cli' },
              { key: 'appId', label: 'API Base URL', placeholder: 'http://localhost:8080', description: 'URL of your signal-cli-rest-api instance' },
            ]}
            setupInstructions={<SetupGuide steps={SIGNAL_SETUP_STEPS} />}
            pluginStatus={signalStatus}
            onStatusChange={(s) => handleStatusChange('signal', s)}
          />
        ),
      },
    ];
  }, [pluginStatuses, selectedModel, modelList, enableLoading, t, handleStatusChange]);

  const getToggleHandler = (channelId: string): ((enabled: boolean) => void) | undefined => {
    const type = channelId as PluginType;
    if (PLUGIN_IDS[type]) {
      return (enabled: boolean): void => void handleTogglePlugin(type, enabled);
    }
    return undefined;
  };

  return (
    <FoundryScrollArea className={isPageMode ? 'h-full' : ''}>
      <div className='flex flex-col gap-12px'>
        {channels.map((channelConfig) => (
          <ChannelItem key={channelConfig.id} channel={channelConfig} isCollapsed={collapseKeys[channelConfig.id] || false} onToggleCollapse={() => handleToggleCollapse(channelConfig.id)} onToggleEnabled={getToggleHandler(channelConfig.id)} />
        ))}
      </div>
    </FoundryScrollArea>
  );
};

export default ChannelModalContent;
