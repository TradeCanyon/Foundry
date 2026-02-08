/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Down } from '@icon-park/react';
import classNames from 'classnames';
import React from 'react';

interface WorkspaceCollapseProps {
  /** Whether expanded */
  expanded: boolean;
  /** Toggle expand state callback */
  onToggle: () => void;
  /** Collapse panel header */
  header: React.ReactNode;
  /** Collapse panel content */
  children: React.ReactNode;
  /** Additional class name */
  className?: string;
  /** Whether sider is collapsed - hide group title and remove indent when collapsed */
  siderCollapsed?: boolean;
}

/**
 * Workspace collapse component - simple collapse panel for workspace grouping
 */
const WorkspaceCollapse: React.FC<WorkspaceCollapseProps> = ({ expanded, onToggle, header, children, className, siderCollapsed = false }) => {
  // When sider is collapsed, force expand content and hide header
  const showContent = siderCollapsed || expanded;

  return (
    <div className={classNames('workspace-collapse min-w-0', className)}>
      {/* Collapse header - hidden when sider is collapsed */}
      {!siderCollapsed && (
        <div className='flex items-center ml-2px gap-8px h-32px p-4px cursor-pointer hover:bg-hover rd-4px transition-colors min-w-0' onClick={onToggle}>
          {/* Expand/collapse arrow */}
          <Down size={16} className={classNames('line-height-0 transition-transform duration-200 flex-shrink-0', expanded ? 'rotate-0' : '-rotate-90')} />

          {/* Header content */}
          <div className='flex-1 ml-6px min-w-0 overflow-hidden'>{header}</div>
        </div>
      )}

      {/* Collapse content - remove left margin when sider is collapsed */}
      {showContent && <div className={classNames('workspace-collapse-content min-w-0', { 'ml-8px': !siderCollapsed })}>{children}</div>}
    </div>
  );
};

export default WorkspaceCollapse;
