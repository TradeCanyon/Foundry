/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { voice } from '@/common/ipcBridge';
import FoundryScrollArea from '@/renderer/components/base/FoundryScrollArea';
import { Button, Message, Select, Switch, Tooltip } from '@arco-design/web-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsViewMode } from '../settingsViewContext';

interface VoiceSettings {
  enabled: boolean;
  sttProvider: string;
  ttsProvider: string;
  ttsVoice: string;
  autoSend: boolean;
}

const TTS_VOICES = [
  { label: 'Alloy', value: 'alloy' },
  { label: 'Echo', value: 'echo' },
  { label: 'Fable', value: 'fable' },
  { label: 'Onyx', value: 'onyx' },
  { label: 'Nova', value: 'nova' },
  { label: 'Shimmer', value: 'shimmer' },
];

const STT_PROVIDERS = [
  { label: 'OpenAI Whisper', value: 'openai', tooltip: 'Requires an OpenAI API key. High accuracy, supports many languages.' },
  { label: 'Local (Browser)', value: 'local', tooltip: 'Uses browser Web Speech API. Free but less accurate.' },
];

const TTS_PROVIDERS = [
  { label: 'OpenAI TTS', value: 'openai', tooltip: 'High-quality neural voices via OpenAI API. Requires API key.' },
  { label: 'None (Disabled)', value: 'none', tooltip: 'Disable text-to-speech. Responses are text only.' },
];

const VoiceModalContent: React.FC = () => {
  const { t } = useTranslation();
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';
  const [settings, setSettings] = useState<VoiceSettings>({
    enabled: true,
    sttProvider: 'openai',
    ttsProvider: 'openai',
    ttsVoice: 'nova',
    autoSend: false,
  });
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const config = await voice.getConfig.invoke();
      setSettings({
        enabled: config.enabled,
        sttProvider: config.sttProvider,
        ttsProvider: config.ttsProvider,
        ttsVoice: config.ttsVoice,
        autoSend: config.autoSend,
      });
    } catch (error) {
      console.error('[VoiceSettings] Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const updateSetting = async (key: keyof VoiceSettings, value: string | boolean) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    try {
      await voice.setConfig.invoke({ [key]: value });
    } catch (error: any) {
      Message.error(error.message || 'Failed to save voice setting');
    }
  };

  if (loading) {
    return <div className='py-20px text-center text-t-secondary'>Loading...</div>;
  }

  return (
    <FoundryScrollArea className={isPageMode ? 'h-full' : ''}>
      <div className='flex flex-col gap-20px'>
        <div className='text-16px font-600 text-t-primary'>{t('settings.voice', 'Voice Mode')}</div>

        {/* Enable/Disable */}
        <div className='flex items-center justify-between'>
          <div>
            <div className='text-14px font-500 text-t-primary'>{t('settings.voice.enabled', 'Enabled')}</div>
            <div className='text-12px text-t-secondary mt-2px'>{t('settings.voice.enabledDesc', 'Enable voice input and output in conversations')}</div>
          </div>
          <Switch checked={settings.enabled} onChange={(val) => updateSetting('enabled', val)} />
        </div>

        {/* STT Provider */}
        <div className='flex flex-col gap-6px'>
          <div className='text-14px font-500 text-t-primary'>{t('settings.voice.sttProvider', 'Speech-to-Text Provider')}</div>
          <div className='text-12px text-t-secondary'>{t('settings.voice.sttProviderDesc', 'Service used to convert your voice to text')}</div>
          <Select value={settings.sttProvider} onChange={(val) => updateSetting('sttProvider', val)} style={{ width: '100%' }}>
            {STT_PROVIDERS.map((p) => (
              <Select.Option key={p.value} value={p.value}>
                <Tooltip content={p.tooltip} position='right'>
                  <span>{p.label}</span>
                </Tooltip>
              </Select.Option>
            ))}
          </Select>
        </div>

        {/* TTS Provider */}
        <div className='flex flex-col gap-6px'>
          <div className='text-14px font-500 text-t-primary'>{t('settings.voice.ttsProvider', 'Text-to-Speech Provider')}</div>
          <div className='text-12px text-t-secondary'>{t('settings.voice.ttsProviderDesc', 'Service used to read responses aloud')}</div>
          <Select value={settings.ttsProvider} onChange={(val) => updateSetting('ttsProvider', val)} style={{ width: '100%' }}>
            {TTS_PROVIDERS.map((p) => (
              <Select.Option key={p.value} value={p.value}>
                <Tooltip content={p.tooltip} position='right'>
                  <span>{p.label}</span>
                </Tooltip>
              </Select.Option>
            ))}
          </Select>
        </div>

        {/* TTS Voice */}
        {settings.ttsProvider !== 'none' && (
          <div className='flex flex-col gap-6px'>
            <div className='text-14px font-500 text-t-primary'>{t('settings.voice.ttsVoice', 'Voice')}</div>
            <div className='text-12px text-t-secondary'>{t('settings.voice.ttsVoiceDesc', 'Voice character for text-to-speech')}</div>
            <div className='flex items-center gap-8px'>
              <Select value={settings.ttsVoice} onChange={(val) => updateSetting('ttsVoice', val)} style={{ flex: 1 }}>
                {TTS_VOICES.map((v) => (
                  <Select.Option key={v.value} value={v.value}>
                    {v.label}
                  </Select.Option>
                ))}
              </Select>
              <Button
                size='small'
                loading={previewLoading}
                onClick={async () => {
                  setPreviewLoading(true);
                  try {
                    const result = await voice.synthesize.invoke({ text: 'Hello! This is how I sound.' });
                    if (result?.audioPath) {
                      const audio = new Audio(`file://${result.audioPath}`);
                      audio.play().catch(() => Message.error('Failed to play audio'));
                    } else {
                      Message.error('No audio file returned');
                    }
                  } catch (err: any) {
                    Message.error(err.message || 'Failed to preview voice');
                  } finally {
                    setPreviewLoading(false);
                  }
                }}
              >
                Preview
              </Button>
            </div>
          </div>
        )}

        {/* Auto-send */}
        <div className='flex items-center justify-between'>
          <div>
            <div className='text-14px font-500 text-t-primary'>{t('settings.voice.autoSend', 'Auto-send after transcription')}</div>
            <div className='text-12px text-t-secondary mt-2px'>{t('settings.voice.autoSendDesc', 'Automatically send the message after voice transcription completes')}</div>
          </div>
          <Switch checked={settings.autoSend} onChange={(val) => updateSetting('autoSend', val)} />
        </div>
      </div>
    </FoundryScrollArea>
  );
};

export default VoiceModalContent;
