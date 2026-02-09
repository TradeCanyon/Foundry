/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * VoiceModeButton — Microphone button with recording UI.
 *
 * Uses browser MediaRecorder API to capture audio, sends to
 * voice.saveRecording → voice.transcribe for STT.
 * Emits 'sendbox.fill' with transcribed text.
 */

import { voice } from '@/common/ipcBridge';
import { emitter } from '@/renderer/utils/emitter';
import { Tooltip } from '@arco-design/web-react';
import React, { useCallback, useRef, useState } from 'react';

type RecordingState = 'idle' | 'recording' | 'transcribing';

const VoiceModeButton: React.FC = () => {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        void processRecording();
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (error) {
      console.error('[VoiceMode] Failed to start recording:', error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const processRecording = useCallback(async () => {
    setState('transcribing');
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      // Save recording to temp file
      const { filePath } = await voice.saveRecording.invoke({
        audioData: base64,
        format: 'webm',
      });

      // Transcribe
      const result = await voice.transcribe.invoke({ audioPath: filePath });

      if (result.text) {
        // Fill the send box with transcribed text
        emitter.emit('sendbox.fill', result.text);
      }
    } catch (error) {
      console.error('[VoiceMode] Transcription failed:', error);
    } finally {
      setState('idle');
      setDuration(0);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (state === 'idle') {
      void startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
    // Don't do anything during transcribing
  }, [state, startRecording, stopRecording]);

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isActive = state !== 'idle';

  return (
    <Tooltip content={state === 'idle' ? 'Voice input' : state === 'recording' ? 'Click to stop' : 'Transcribing...'} mini>
      <button
        onClick={handleClick}
        disabled={state === 'transcribing'}
        className='flex items-center justify-center gap-4px h-28px rd-full b-none cursor-pointer transition-all duration-150'
        style={{
          backgroundColor: isActive ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
          color: isActive ? 'var(--danger)' : 'var(--text-tertiary)',
          padding: isActive ? '0 10px' : '0',
          width: isActive ? 'auto' : '28px',
          minWidth: '28px',
        }}
      >
        {state === 'transcribing' ? (
          <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' className='animate-pulse'>
            <circle cx='12' cy='12' r='10' />
            <path d='M12 6v6l4 2' />
          </svg>
        ) : (
          <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z' />
            <path d='M19 10v2a7 7 0 0 1-14 0v-2' />
            <line x1='12' y1='19' x2='12' y2='23' />
            <line x1='8' y1='23' x2='16' y2='23' />
          </svg>
        )}
        {state === 'recording' && <span className='text-12px font-mono'>{formatDuration(duration)}</span>}
      </button>
    </Tooltip>
  );
};

export default VoiceModeButton;
