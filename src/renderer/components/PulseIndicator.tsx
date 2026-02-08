/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface PulseIndicatorProps {
  /** Size in pixels */
  size?: number;
  /** Primary color */
  primaryColor?: string;
  /** Secondary color */
  secondaryColor?: string;
  /** Custom className */
  className?: string;
}

/**
 * Animated pulse/ripple indicator for showing processing state
 * Uses CSS animations for smooth, performant rendering
 */
const PulseIndicator: React.FC<PulseIndicatorProps> = ({ size = 24, primaryColor = '#ffcc00', secondaryColor = '#ffaa00', className = '' }) => {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='xMidYMid' width={size} height={size} className={className} style={{ shapeRendering: 'auto', display: 'block', background: 'transparent' }}>
      <g>
        <circle strokeWidth='11' stroke={primaryColor} fill='none' r='0' cy='50' cx='50'>
          <animate begin='0s' calcMode='spline' keySplines='0 0.2 0.8 1' keyTimes='0;1' values='0;40' dur='1s' repeatCount='indefinite' attributeName='r' />
          <animate begin='0s' calcMode='spline' keySplines='0.2 0 0.8 1' keyTimes='0;1' values='1;0' dur='1s' repeatCount='indefinite' attributeName='opacity' />
        </circle>
        <circle strokeWidth='11' stroke={secondaryColor} fill='none' r='0' cy='50' cx='50'>
          <animate begin='-0.5s' calcMode='spline' keySplines='0 0.2 0.8 1' keyTimes='0;1' values='0;40' dur='1s' repeatCount='indefinite' attributeName='r' />
          <animate begin='-0.5s' calcMode='spline' keySplines='0.2 0 0.8 1' keyTimes='0;1' values='1;0' dur='1s' repeatCount='indefinite' attributeName='opacity' />
        </circle>
      </g>
    </svg>
  );
};

export default PulseIndicator;
