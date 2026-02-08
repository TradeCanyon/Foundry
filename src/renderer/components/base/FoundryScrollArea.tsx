/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import classNames from 'classnames';
import React from 'react';

/**
 * Custom scroll area component
 *
 * Provides unified scrollbar styling, supports vertical, horizontal or both directions
 *
 * @example
 * ```tsx
 * // Vertical scroll (default)
 * <FoundryScrollArea className="h-400px">
 *   <div>Content...</div>
 * </FoundryScrollArea>
 *
 * // Horizontal scroll
 * <FoundryScrollArea direction="x" className="w-400px">
 *   <div className="whitespace-nowrap">Content...</div>
 * </FoundryScrollArea>
 *
 * // Both directions
 * <FoundryScrollArea direction="both" className="h-400px w-400px">
 *   <div>Content...</div>
 * </FoundryScrollArea>
 * ```
 */
interface FoundryScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Scroll direction: y-vertical, x-horizontal, both-bidirectional */
  direction?: 'y' | 'x' | 'both';
  /** Whether to disable overflow (for embedded page display) */
  disableOverflow?: boolean;
}

const FoundryScrollArea: React.FC<FoundryScrollAreaProps> = ({ children, className, direction = 'y', disableOverflow = false, ...rest }) => {
  // Set overflow class based on direction
  const overflowClass = disableOverflow ? '' : direction === 'both' ? 'overflow-auto' : direction === 'x' ? 'overflow-x-auto overflow-y-hidden' : 'overflow-y-auto overflow-x-hidden';

  return (
    <div data-scroll-area='' className={classNames(overflowClass, disableOverflow && 'overflow-visible', className)} {...rest}>
      {children}
    </div>
  );
};

FoundryScrollArea.displayName = 'FoundryScrollArea';

export default FoundryScrollArea;
