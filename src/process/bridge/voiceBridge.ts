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
import { voiceService, type VoiceConfig } from '@process/services/voiceService';

export function initVoiceBridge(): void {
  voice.transcribe.provider(async ({ audioPath }) => {
    return voiceService.transcribe(audioPath);
  });

  voice.synthesize.provider(async ({ text }) => {
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
