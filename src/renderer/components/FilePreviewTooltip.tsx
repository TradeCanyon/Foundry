/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { Tooltip, Spin } from '@arco-design/web-react';
import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface FilePreviewData {
  type: 'image' | 'text' | 'info' | 'error';
  fileName?: string;
  size?: string;
  lineCount?: number;
  modifiedDate?: string;
  preview?: string;
  thumbnail?: string;
  error?: string;
}

interface FilePreviewTooltipProps {
  /** File path to preview */
  filePath: string;
  /** Child element that triggers the tooltip */
  children: React.ReactNode;
  /** Disable the preview tooltip */
  disabled?: boolean;
  /** Hover delay in ms before showing preview (default: 400) */
  hoverDelay?: number;
}

// Determine file type from extension
const getFileType = (path: string): 'image' | 'text' | 'binary' => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'];
  const textExts = ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'scss', 'less', 'html', 'xml', 'yaml', 'yml', 'toml', 'ini', 'conf', 'sh', 'bash', 'zsh', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'sql', 'graphql', 'vue', 'svelte', 'astro'];

  if (imageExts.includes(ext)) return 'image';
  if (textExts.includes(ext)) return 'text';
  return 'binary';
};

// Format bytes to human-readable size (reserved for future use)
const _formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Preview content renderer
 */
const PreviewContent: React.FC<{ data: FilePreviewData | null; loading: boolean }> = ({ data, loading }) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className='w-200px h-80px flex items-center justify-center'>
        <Spin size={20} />
      </div>
    );
  }

  if (!data || data.type === 'error') {
    return <div className='text-12px text-t-tertiary p-8px max-w-200px'>{data?.error || t('preview.unavailable', 'Preview unavailable')}</div>;
  }

  // Image preview
  if (data.type === 'image' && data.thumbnail) {
    return (
      <div className='p-4px'>
        <img src={data.thumbnail} alt={data.fileName || 'Preview'} className='max-w-200px max-h-150px rd-4px object-contain' style={{ display: 'block' }} />
        {data.fileName && <div className='text-10px text-t-tertiary mt-4px truncate max-w-200px'>{data.fileName}</div>}
      </div>
    );
  }

  // Text/code preview
  if (data.type === 'text' && data.preview) {
    return (
      <div className='max-w-300px'>
        <div className='text-10px text-t-tertiary px-8px pt-8px pb-4px flex items-center gap-8px'>
          <span className='truncate'>{data.fileName}</span>
          {data.lineCount && <span>· {data.lineCount} lines</span>}
        </div>
        <pre className='text-11px font-mono bg-bg-2 p-8px m-0 rd-4px overflow-hidden max-h-150px text-t-primary whitespace-pre-wrap break-all'>{data.preview}</pre>
      </div>
    );
  }

  // Info-only preview (large files, binary files)
  return (
    <div className='p-8px min-w-150px'>
      <div className='text-12px font-medium text-t-primary truncate'>{data.fileName}</div>
      <div className='text-11px text-t-tertiary mt-4px flex items-center gap-8px'>
        {data.size && <span>{data.size}</span>}
        {data.modifiedDate && <span>· {data.modifiedDate}</span>}
      </div>
    </div>
  );
};

/**
 * File preview tooltip that shows a preview of file contents on hover.
 * Uses progressive disclosure - shows preview after a short delay.
 */
const FilePreviewTooltip: React.FC<FilePreviewTooltipProps> = ({ filePath, children, disabled = false, hoverDelay = 400 }) => {
  const [preview, setPreview] = useState<FilePreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  const loadedRef = useRef(false);

  const loadPreview = useCallback(async () => {
    if (loadedRef.current || !filePath) return;

    setLoading(true);
    loadedRef.current = true;

    try {
      const fileType = getFileType(filePath);

      // For images, use getImageBase64 which returns a data URL
      if (fileType === 'image') {
        const dataUrl = await ipcBridge.fs.getImageBase64.invoke({ path: filePath });

        if (dataUrl) {
          setPreview({
            type: 'image',
            thumbnail: dataUrl,
            fileName: filePath.split(/[/\\]/).pop(),
          });
        } else {
          setPreview({ type: 'error', error: 'Could not read image' });
        }
      }
      // For text files, read content
      else if (fileType === 'text') {
        const result = await ipcBridge.fs.readFile.invoke({ path: filePath });

        if (result) {
          const lines = result.split('\n');
          const previewLines = lines.slice(0, 12);
          const previewText = previewLines.join('\n');
          // Truncate if too long
          const truncated = previewText.length > 500 ? previewText.slice(0, 500) + '...' : previewText;

          setPreview({
            type: 'text',
            preview: truncated,
            fileName: filePath.split(/[/\\]/).pop(),
            lineCount: lines.length,
          });
        } else {
          setPreview({ type: 'error', error: 'Could not read file' });
        }
      }
      // For binary/other files, just show file info
      else {
        setPreview({
          type: 'info',
          fileName: filePath.split(/[/\\]/).pop(),
        });
      }
    } catch (e) {
      console.warn('File preview error:', e);
      setPreview({
        type: 'error',
        error: 'Preview unavailable',
      });
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  const handleMouseEnter = useCallback(() => {
    if (disabled) return;

    timeoutRef.current = window.setTimeout(() => {
      setVisible(true);
      void loadPreview();
    }, hoverDelay);
  }, [disabled, hoverDelay, loadPreview]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setVisible(false);
  }, []);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <Tooltip trigger='hover' position='top' content={<PreviewContent data={preview} loading={loading} />} popupVisible={visible} mini={false} color='var(--bg-1)' className='file-preview-tooltip'>
      <span onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className='cursor-pointer'>
        {children}
      </span>
    </Tooltip>
  );
};

export default FilePreviewTooltip;
