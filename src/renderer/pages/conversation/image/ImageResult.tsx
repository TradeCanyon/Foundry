/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { Button, Tooltip } from '@arco-design/web-react';
import { Copy, FolderOpen, Redo } from '@icon-park/react';
import { iconColors } from '@/renderer/theme/colors';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ImageResultData {
  id: string;
  prompt: string;
  imagePath?: string;
  textResponse?: string;
  error?: string;
  loading?: boolean;
  createdAt?: number;
}

interface ImageResultProps {
  result: ImageResultData;
  onRegenerate?: (prompt: string) => void;
}

const ImageResult: React.FC<ImageResultProps> = ({ result, onRegenerate }) => {
  const { t } = useTranslation();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!result.imagePath) return;
    let cancelled = false;
    ipcBridge.fs.getImageBase64
      .invoke({ path: result.imagePath })
      .then((dataUrl) => {
        if (!cancelled) setImageDataUrl(dataUrl);
      })
      .catch(() => {
        // Ignore load errors
      });
    return () => {
      cancelled = true;
    };
  }, [result.imagePath]);

  const handleCopyPath = useCallback(() => {
    if (result.imagePath) {
      void navigator.clipboard.writeText(result.imagePath);
    }
  }, [result.imagePath]);

  const handleShowInFolder = useCallback(() => {
    if (result.imagePath) {
      void ipcBridge.shell.showItemInFolder.invoke(result.imagePath);
    }
  }, [result.imagePath]);

  if (result.loading) {
    return (
      <div className='flex flex-col items-center gap-16px py-24px'>
        <div className='text-14px text-t-secondary animate-pulse'>{t('image.generating', { defaultValue: 'Generating image...' })}</div>
        <div className='text-13px text-t-tertiary'>{result.prompt}</div>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className='flex flex-col gap-8px p-16px rd-12px' style={{ background: 'var(--color-danger-light-1)', border: '1px solid var(--color-danger-light-3)' }}>
        <div className='text-14px text-[rgb(var(--danger-6))]'>{result.error}</div>
        <div className='text-13px text-t-tertiary'>{result.prompt}</div>
        {onRegenerate && (
          <Button size='small' type='text' icon={<Redo theme='outline' size={14} />} onClick={() => onRegenerate(result.prompt)}>
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-12px'>
      <div className='text-13px text-t-secondary'>{result.prompt}</div>
      {imageDataUrl && (
        <div className='relative group'>
          <img src={imageDataUrl} alt={result.prompt} className='max-w-full max-h-512px rd-12px object-contain cursor-pointer' style={{ background: 'var(--color-fill-2)' }} onClick={handleShowInFolder} />
          <div className='absolute top-8px right-8px flex gap-4px opacity-0 group-hover:opacity-100 transition-opacity'>
            <Tooltip content={t('common.copy', { defaultValue: 'Copy path' })}>
              <Button size='small' shape='circle' icon={<Copy theme='outline' size={14} fill={iconColors.primary} />} onClick={handleCopyPath} />
            </Tooltip>
            <Tooltip content={t('image.showInFolder', { defaultValue: 'Show in folder' })}>
              <Button size='small' shape='circle' icon={<FolderOpen theme='outline' size={14} fill={iconColors.primary} />} onClick={handleShowInFolder} />
            </Tooltip>
            {onRegenerate && (
              <Tooltip content={t('image.regenerate', { defaultValue: 'Regenerate' })}>
                <Button size='small' shape='circle' icon={<Redo theme='outline' size={14} fill={iconColors.primary} />} onClick={() => onRegenerate(result.prompt)} />
              </Tooltip>
            )}
          </div>
        </div>
      )}
      {result.textResponse && <div className='text-14px text-t-primary'>{result.textResponse}</div>}
    </div>
  );
};

export default ImageResult;
