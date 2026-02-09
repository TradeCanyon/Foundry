/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * voiceBridge — IPC bridge for voice mode.
 *
 * Registers providers for:
 * - voice.transcribe: Convert audio to text (STT)
 * - voice.synthesize: Convert text to audio (TTS)
 * - voice.save-recording: Save audio buffer to temp file
 * - voice.get-config: Get voice settings
 * - voice.set-config: Update voice settings
 */

import { voice } from '@/common/ipcBridge';
import { RateLimiter } from '@/channels/utils/rateLimiter';
import { voiceService, type VoiceConfig } from '@process/services/voiceService';

const voiceRateLimiter = new RateLimiter({ maxAttempts: 30, windowMs: 60_000 });

export function initVoiceBridge(): void {
  voice.transcribe.provider(async ({ audioPath }) => {
    const { allowed, retryAfterMs } = voiceRateLimiter.check('voice.transcribe');
    if (!allowed) {
      throw new Error(`Rate limited. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`);
    }
    return voiceService.transcribe(audioPath);
  });

  voice.synthesize.provider(async ({ text }) => {
    const { allowed, retryAfterMs } = voiceRateLimiter.check('voice.synthesize');
    if (!allowed) {
      throw new Error(`Rate limited. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`);
    }
    return voiceService.synthesize(text);
  });

  voice.saveRecording.provider(async ({ audioData, format }) => {
    const buffer = Buffer.from(audioData, 'base64');
    const filePath = voiceService.saveRecording(buffer, format);
    return { filePath };
  });

  voice.getConfig.provider(async () => {
    return voiceService.getConfig();
  });

  voice.setConfig.provider(async (updates) => {
    voiceService.setConfig(updates as Partial<VoiceConfig>);
  });
}
