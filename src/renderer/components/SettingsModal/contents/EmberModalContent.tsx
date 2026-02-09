/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * EmberModalContent — Settings panel for Ember assistant.
 *
 * Configures personality, autonomy level, custom prompt, and enable/disable.
 * Also shows recent activity feed.
 */

import { ember, type IEmberActivity, type IEmberConfig } from '@/common/ipcBridge';
import { Input, Radio, Select, Switch, Tooltip } from '@arco-design/web-react';
import React, { useCallback, useEffect, useState } from 'react';

const PERSONALITIES = [
  { id: 'bubbly', name: 'Bubbly', desc: 'Warm, enthusiastic, encouraging' },
  { id: 'professional', name: 'Professional', desc: 'Clear, efficient, business-focused' },
  { id: 'casual', name: 'Casual', desc: 'Relaxed, like texting a smart friend' },
  { id: 'minimal', name: 'Minimal', desc: 'Just the facts, shortest responses' },
  { id: 'custom', name: 'Custom', desc: 'Your own personality prompt' },
] as const;

const AUTONOMY_LEVELS = [
  { id: 'guided', name: 'Guided', desc: 'Always confirms before acting', tooltip: 'Ember asks before taking any action' },
  { id: 'balanced', name: 'Balanced', desc: 'Handles routine tasks autonomously', tooltip: 'Ember handles routine tasks, asks for important ones' },
  { id: 'free_reign', name: 'Free Reign', desc: 'Acts proactively with minimal confirmation', tooltip: 'Ember acts autonomously on all tasks' },
] as const;

const EMBER_MODELS = [
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
  { label: 'Gemini 2.0 Flash Lite', value: 'gemini-2.0-flash-lite' },
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash-preview-04-17' },
  { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
] as const;

const EmberModalContent: React.FC = () => {
  const [config, setConfig] = useState<IEmberConfig | null>(null);
  const [activity, setActivity] = useState<IEmberActivity[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');

  // Load config and activity
  useEffect(() => {
    let cancelled = false;
    void ember.getConfig.invoke().then((cfg) => {
      if (cancelled) return;
      setConfig(cfg);
      setCustomPrompt(cfg.customPrompt ?? '');
    });
    void ember.getActivity.invoke({ limit: 10 }).then((acts) => {
      if (cancelled) return;
      setActivity(acts);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateConfig = useCallback(
    (updates: Partial<IEmberConfig>) => {
      if (!config) return;
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);
      void ember.setConfig.invoke(updates);
    },
    [config]
  );

  if (!config) {
    return <div className='text-t-secondary text-14px'>Loading Ember settings...</div>;
  }

  return (
    <div className='space-y-24px'>
      {/* Enable/Disable */}
      <div className='flex items-center justify-between'>
        <div>
          <div className='text-16px font-semibold text-t-primary'>Ember Assistant</div>
          <div className='text-13px text-t-secondary mt-2px'>Your personal AI assistant powered by Gemini Flash</div>
        </div>
        <Switch checked={config.enabled} onChange={(enabled) => updateConfig({ enabled })} />
      </div>

      {/* Personality */}
      <div>
        <div className='text-14px font-medium text-t-primary mb-8px'>Personality</div>
        <Radio.Group value={config.personality} onChange={(val: string) => updateConfig({ personality: val })} direction='vertical' className='w-full'>
          {PERSONALITIES.map((p) => (
            <Radio key={p.id} value={p.id} className='!mb-8px'>
              <span className='text-14px text-t-primary'>{p.name}</span>
              <span className='text-12px text-t-secondary ml-8px'>{p.desc}</span>
            </Radio>
          ))}
        </Radio.Group>
      </div>

      {/* Custom Prompt (visible when personality = custom) */}
      {config.personality === 'custom' && (
        <div>
          <div className='text-14px font-medium text-t-primary mb-8px'>Custom Personality Prompt</div>
          <Input.TextArea value={customPrompt} onChange={(val) => setCustomPrompt(val)} onBlur={() => updateConfig({ customPrompt })} placeholder='Describe how Ember should communicate...' autoSize={{ minRows: 3, maxRows: 8 }} className='text-14px' />
        </div>
      )}

      {/* Model */}
      <div>
        <div className='text-14px font-medium text-t-primary mb-8px'>Model</div>
        <Select value={config.model || 'gemini-2.0-flash'} onChange={(val: string) => updateConfig({ model: val })} style={{ width: '100%' }}>
          {EMBER_MODELS.map((m) => (
            <Select.Option key={m.value} value={m.value}>
              {m.label}
            </Select.Option>
          ))}
        </Select>
        <div className='text-12px text-t-tertiary mt-4px'>The Gemini model used for Ember's brain</div>
      </div>

      {/* Autonomy Level */}
      <div>
        <div className='text-14px font-medium text-t-primary mb-8px'>Autonomy Level</div>
        <Radio.Group value={config.autonomy} onChange={(val: string) => updateConfig({ autonomy: val })} direction='vertical' className='w-full'>
          {AUTONOMY_LEVELS.map((a) => (
            <Radio key={a.id} value={a.id} className='!mb-8px'>
              <Tooltip content={a.tooltip} position='right'>
                <span>
                  <span className='text-14px text-t-primary'>{a.name}</span>
                  <span className='text-12px text-t-secondary ml-8px'>{a.desc}</span>
                </span>
              </Tooltip>
            </Radio>
          ))}
        </Radio.Group>
      </div>

      {/* Activity Feed */}
      {activity.length > 0 && (
        <div>
          <div className='text-14px font-medium text-t-primary mb-8px'>Recent Activity</div>
          <div className='space-y-6px'>
            {activity.map((act) => (
              <div key={act.id} className='flex items-start gap-8px px-12px py-8px bg-fill-1 rd-8px text-13px'>
                <span className={act.success ? 'text-[rgb(var(--success-6))]' : 'text-[rgb(var(--danger-6))]'}>{act.success ? '\u2713' : '\u2717'}</span>
                <div className='flex-1 min-w-0'>
                  <div className='text-t-primary truncate'>{act.detail}</div>
                  <div className='text-t-tertiary text-11px mt-2px'>
                    {act.action} \u00B7 {new Date(act.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmberModalContent;
