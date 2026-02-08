/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { ImageProviderStatus } from '@/common/ipcBridge';
import { uuid } from '@/common/utils';
import { Button, Spin } from '@arco-design/web-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ImageResult, { type ImageResultData } from './ImageResult';
import ImageSendBox from './ImageSendBox';

interface ImageChatProps {
  conversation_id: string;
}

const ImageChat: React.FC<ImageChatProps> = ({ conversation_id }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [results, setResults] = useState<ImageResultData[]>([]);
  const [providerStatus, setProviderStatus] = useState<ImageProviderStatus | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialMessageConsumed = useRef(false);

  // Check provider availability on mount
  useEffect(() => {
    ipcBridge.image.getStatus
      .invoke()
      .then((res) => {
        if (res.success && res.data) {
          setProviderStatus(res.data);
        } else {
          setProviderStatus({ available: false, reason: res.msg || 'Failed to check image generation status.' });
        }
      })
      .catch(() => {
        setProviderStatus({ available: false, reason: 'Failed to check image generation status.' });
      });
  }, []);

  // Load persisted results on mount
  useEffect(() => {
    ipcBridge.conversation.get
      .invoke({ id: conversation_id })
      .then((conv) => {
        if (conv?.type === 'image' && conv.extra?.results?.length) {
          setResults(conv.extra.results.map((r) => ({ ...r, loading: false })));
        }
      })
      .catch(() => {
        // Ignore load errors
      });
  }, [conversation_id]);

  // Persist results to conversation extra (skip loading entries)
  const persistResults = useCallback(
    (allResults: ImageResultData[]) => {
      const toPersist = allResults
        .filter((r) => !r.loading)
        .map((r) => ({
          id: r.id,
          prompt: r.prompt,
          imagePath: r.imagePath,
          textResponse: r.textResponse,
          error: r.error,
          createdAt: r.createdAt || Date.now(),
        }));
      void ipcBridge.conversation.update.invoke({
        id: conversation_id,
        updates: { extra: { results: toPersist } } as any,
        mergeExtra: true,
      });
    },
    [conversation_id]
  );

  // Scroll to bottom when new results arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [results]);

  const generate = useCallback(
    async (prompt: string) => {
      const id = uuid();
      const createdAt = Date.now();

      // Add loading entry
      setResults((prev) => [...prev, { id, prompt, loading: true, createdAt }]);

      try {
        const response = await ipcBridge.image.generate.invoke({ prompt });

        if (!response.success) {
          setResults((prev) => {
            const updated = prev.map((r) => (r.id === id ? { ...r, loading: false, error: response.msg || 'Generation failed' } : r));
            persistResults(updated);
            return updated;
          });
          return;
        }

        setResults((prev) => {
          const updated = prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  loading: false,
                  imagePath: response.data?.imagePath,
                  textResponse: response.data?.textResponse,
                }
              : r
          );
          persistResults(updated);
          return updated;
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setResults((prev) => {
          const updated = prev.map((r) => (r.id === id ? { ...r, loading: false, error: errorMessage } : r));
          persistResults(updated);
          return updated;
        });
      }
    },
    [persistResults]
  );

  // Pick up initial message from guid page
  useEffect(() => {
    if (initialMessageConsumed.current) return;
    initialMessageConsumed.current = true;

    const key = `image_initial_message_${conversation_id}`;
    const stored = sessionStorage.getItem(key);
    if (stored) {
      sessionStorage.removeItem(key);
      try {
        const { input } = JSON.parse(stored);
        if (input) {
          void generate(input);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [conversation_id, generate]);

  const isGenerating = results.some((r) => r.loading);

  // Loading state
  if (providerStatus === null) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <Spin />
      </div>
    );
  }

  // Unavailable state
  if (providerStatus.available === false) {
    return (
      <div className='flex-1 flex flex-col items-center justify-center gap-16px px-20px'>
        <div className='text-16px text-t-secondary text-center max-w-480px'>{providerStatus.reason}</div>
        <Button type='primary' onClick={() => navigate('/settings/image')}>
          {t('settings.imageSettings', { defaultValue: 'Open Image Settings' })}
        </Button>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col min-h-0'>
      <div ref={scrollRef} className='flex-1 overflow-auto px-20px py-16px'>
        {results.length === 0 && <div className='flex items-center justify-center h-full text-t-tertiary text-14px'>{t('image.emptyPrompt', { defaultValue: 'Enter a prompt below to generate an image' })}</div>}
        <div className='flex flex-col gap-24px max-w-640px mx-auto'>
          {results.map((result) => (
            <ImageResult key={result.id} result={result} onRegenerate={!isGenerating ? generate : undefined} />
          ))}
        </div>
      </div>
      <ImageSendBox onSend={generate} disabled={isGenerating} />
    </div>
  );
};

export default ImageChat;
