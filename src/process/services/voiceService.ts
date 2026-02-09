/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * voiceService — Voice mode backend service.
 *
 * Handles:
 * - Speech-to-Text (STT): Whisper API via OpenAI
 * - Text-to-Speech (TTS): OpenAI TTS or ElevenLabs
 * - Audio file management (temp recording storage)
 *
 * API keys are sourced from the model config (OpenAI provider).
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// ============================================================
// Types
// ============================================================

export interface VoiceConfig {
  sttProvider: 'openai' | 'local';
  ttsProvider: 'openai' | 'elevenlabs' | 'none';
  ttsVoice: string; // e.g., 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
  enabled: boolean;
  autoSend: boolean; // Auto-send after transcription completes
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

export interface SpeechResult {
  audioPath: string;
  format: 'mp3' | 'opus' | 'wav';
}

// ============================================================
// Service
// ============================================================

class VoiceService {
  private config: VoiceConfig = {
    sttProvider: 'openai',
    ttsProvider: 'openai',
    ttsVoice: 'nova',
    enabled: true,
    autoSend: false,
  };

  private tempDir: string;

  constructor() {
    this.tempDir = path.join(app?.getPath?.('temp') ?? '/tmp', 'foundry-voice');
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }
    } catch {
      // May fail in test environment
    }
  }

  getConfig(): VoiceConfig {
    return { ...this.config };
  }

  setConfig(updates: Partial<VoiceConfig>): void {
    Object.assign(this.config, updates);
  }

  /** Validate that a path is within the temp directory (prevent path traversal). */
  private assertSafePath(filePath: string): void {
    const resolved = path.resolve(filePath);
    const resolvedBase = path.resolve(this.tempDir);
    if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
      throw new Error('Invalid audio path: must be within the voice temp directory');
    }
  }

  /**
   * Transcribe audio to text using Whisper API.
   * @param audioPath Path to the audio file (webm/ogg/wav/mp3)
   */
  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    this.assertSafePath(audioPath);

    const apiKey = await this.getOpenAIKey();
    if (!apiKey) {
      throw new Error('OpenAI API key required for voice transcription. Configure in Settings → Model.');
    }

    const audioData = fs.readFileSync(audioPath);
    const fileName = path.basename(audioPath);

    // Build multipart form data
    const boundary = `----FormBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    // File part
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: audio/webm\r\n\r\n`));
    parts.push(audioData);
    parts.push(Buffer.from('\r\n'));

    // Model part
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`));

    // End boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Transcription failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return {
      text: result.text || '',
      language: result.language,
      duration: result.duration,
    };
  }

  /**
   * Generate speech from text using OpenAI TTS.
   * @param text Text to convert to speech
   */
  async synthesize(text: string): Promise<SpeechResult> {
    if (this.config.ttsProvider === 'none') {
      throw new Error('TTS is disabled');
    }

    const apiKey = await this.getOpenAIKey();
    if (!apiKey) {
      throw new Error('OpenAI API key required for text-to-speech. Configure in Settings → Model.');
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text.substring(0, 4096), // TTS has a 4096 char limit
        voice: this.config.ttsVoice || 'nova',
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Speech synthesis failed: ${response.status} ${errorText}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const audioPath = path.join(this.tempDir, `tts-${Date.now()}.mp3`);
    fs.writeFileSync(audioPath, audioBuffer);

    return { audioPath, format: 'mp3' };
  }

  /**
   * Save a recording blob to a temp file for transcription.
   */
  private static readonly ALLOWED_FORMATS = new Set(['webm', 'ogg', 'wav', 'mp3', 'opus']);

  saveRecording(audioBuffer: Buffer, format = 'webm'): string {
    // Whitelist format to prevent path traversal via malicious extensions
    const safeFormat = VoiceService.ALLOWED_FORMATS.has(format) ? format : 'webm';
    const filePath = path.join(this.tempDir, `recording-${Date.now()}.${safeFormat}`);
    fs.writeFileSync(filePath, audioBuffer);
    return filePath;
  }

  /**
   * Clean up old temp audio files.
   */
  cleanup(): void {
    try {
      const files = fs.readdirSync(this.tempDir);
      const cutoff = Date.now() - 3600_000; // 1 hour
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
        }
      }
    } catch {
      // Cleanup is best-effort
    }
  }

  // ---- Helpers ----

  private async getOpenAIKey(): Promise<string | null> {
    let apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      try {
        const { ProcessConfig } = await import('@process/initStorage');
        const modelConfig = await ProcessConfig.get('model.config');
        const openaiProvider = (modelConfig as any[])?.find((p: any) => p.platform?.toLowerCase().includes('openai') && p.apiKey);
        apiKey = openaiProvider?.apiKey;
      } catch {
        // Config not available
      }
    }

    return apiKey || null;
  }
}

// Singleton
export const voiceService = new VoiceService();
