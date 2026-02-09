/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * StubStream — Animated skeleton placeholder shown during active code generation.
 * Displays pulsing lines that mimic code being written, giving visual feedback
 * that the AI is actively generating a code block.
 */

import React from 'react';

interface StubStreamProps {
  language?: string;
}

const StubStream: React.FC<StubStreamProps> = ({ language }) => {
  return (
    <div
      style={{
        width: '100%',
        marginTop: '4px',
        marginBottom: '4px',
        padding: '12px 16px',
        backgroundColor: 'var(--bg-2)',
        border: '1px solid var(--bg-3)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Header with language badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--brand)',
            animation: 'stubStreamPulse 1.2s ease-in-out infinite',
          }}
        />
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{language || 'code'}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>generating...</span>
      </div>

      {/* Skeleton code lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[85, 60, 72, 45, 90, 55].map((width, i) => (
          <div
            key={i}
            style={{
              height: '10px',
              width: `${width}%`,
              borderRadius: '4px',
              backgroundColor: 'var(--bg-3)',
              animation: `stubStreamPulse 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes stubStreamPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default StubStream;
