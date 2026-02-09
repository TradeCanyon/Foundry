/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * StubCard — Smart content card for large code blocks.
 * Renders as a compact file card instead of a full syntax-highlighted block.
 * Click to expand, with copy/download actions.
 */

import { Message } from '@arco-design/web-react';
import { Code, Copy, Down, DownloadOne, Up } from '@icon-park/react';
import React, { useState } from 'react';

interface StubCardProps {
  language: string;
  code: string;
  lineCount: number;
  renderExpanded?: () => React.ReactNode;
}

/** Try to extract a filename from the first line of code (comment-style hints) */
function detectFilename(code: string): string | null {
  const firstLine = code.split('\n')[0]?.trim() || '';
  // Match common comment patterns followed by filename.ext
  const patterns = [
    /^\/\/\s*([\w./-]+\.\w+)/, // // filename.ext
    /^#\s*([\w./-]+\.\w+)/, // # filename.ext
    /^\/\*\s*([\w./-]+\.\w+)/, // /* filename.ext
    /^--\s*([\w./-]+\.\w+)/, // -- filename.ext
  ];
  for (const pat of patterns) {
    const m = firstLine.match(pat);
    if (m) return m[1];
  }
  return null;
}

const LANGUAGE_LABELS: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript (JSX)',
  js: 'JavaScript',
  jsx: 'JavaScript (JSX)',
  py: 'Python',
  python: 'Python',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  json: 'JSON',
  css: 'CSS',
  html: 'HTML',
  sql: 'SQL',
  bash: 'Shell',
  sh: 'Shell',
  yaml: 'YAML',
  yml: 'YAML',
  md: 'Markdown',
  markdown: 'Markdown',
  rust: 'Rust',
  go: 'Go',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  rb: 'Ruby',
  ruby: 'Ruby',
  swift: 'Swift',
  kotlin: 'Kotlin',
  text: 'Plain Text',
};

const StubCard: React.FC<StubCardProps> = ({ language, code, lineCount, renderExpanded }) => {
  const [expanded, setExpanded] = useState(false);
  const filename = detectFilename(code);
  const label = filename || LANGUAGE_LABELS[language] || language;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(code).then(() => {
      Message.success('Copied');
    });
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ext = language || 'txt';
    const downloadName = filename || `code.${ext}`;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Message.success('Downloaded');
  };

  return (
    <div style={{ width: '100%', marginTop: '4px', marginBottom: '4px' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: 'var(--bg-2)',
          border: '1px solid var(--bg-3)',
          borderRadius: expanded ? '8px 8px 0 0' : '8px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Code theme='outline' size='18' fill='var(--text-secondary)' />
        <span
          style={{
            flex: 1,
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{lineCount} lines</span>
        <DownloadOne theme='outline' size='16' fill='var(--text-secondary)' style={{ cursor: 'pointer', flexShrink: 0 }} onClick={handleDownload} title='Download' />
        <Copy theme='outline' size='16' fill='var(--text-secondary)' style={{ cursor: 'pointer', flexShrink: 0 }} onClick={handleCopy} title='Copy' />
        {expanded ? <Up theme='outline' size='16' fill='var(--text-secondary)' /> : <Down theme='outline' size='16' fill='var(--text-secondary)' />}
      </div>

      {expanded && (
        <div
          style={{
            border: '1px solid var(--bg-3)',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            maxHeight: '500px',
            overflow: 'auto',
          }}
        >
          {renderExpanded ? renderExpanded() : <pre style={{ margin: 0, padding: '12px', fontSize: '13px', whiteSpace: 'pre-wrap' }}>{code}</pre>}
        </div>
      )}
    </div>
  );
};

export default StubCard;
