/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Steps } from '@arco-design/web-react';
import type { StepsProps } from '@arco-design/web-react/es/Steps';
import classNames from 'classnames';
import React from 'react';

/**
 * Steps component props
 */
export interface FoundryStepsProps extends StepsProps {
  /** Additional class name */
  className?: string;
}

/**
 * Steps component
 *
 * Wrapper around Arco Design Steps with unified theme styling
 *
 * @features
 * - Custom brand color theme
 * - Special styling for finished state
 * - Full Arco Steps API support
 *
 * @example
 * ```tsx
 * // Basic usage
 * <FoundrySteps current={1}>
 *   <FoundrySteps.Step title="Step 1" description="Description here" />
 *   <FoundrySteps.Step title="Step 2" description="Description here" />
 *   <FoundrySteps.Step title="Step 3" description="Description here" />
 * </FoundrySteps>
 *
 * // Vertical steps
 * <FoundrySteps current={1} direction="vertical">
 *   <FoundrySteps.Step title="Step 1" description="Description" />
 *   <FoundrySteps.Step title="Step 2" description="Description" />
 * </FoundrySteps>
 *
 * // Steps with icons
 * <FoundrySteps current={1}>
 *   <FoundrySteps.Step title="Done" icon={<IconCheck />} />
 *   <FoundrySteps.Step title="In Progress" icon={<IconLoading />} />
 *   <FoundrySteps.Step title="Pending" icon={<IconClock />} />
 * </FoundrySteps>
 *
 * // Mini steps
 * <FoundrySteps current={1} size="small" type="dot">
 *   <FoundrySteps.Step title="Step 1" />
 *   <FoundrySteps.Step title="Step 2" />
 *   <FoundrySteps.Step title="Step 3" />
 * </FoundrySteps>
 * ```
 *
 * @see arco-override.css for custom styles (.foundry-steps)
 */
const FoundrySteps: React.FC<FoundryStepsProps> & { Step: typeof Steps.Step } = ({ className, ...props }) => {
  return <Steps {...props} className={classNames('foundry-steps', className)} />;
};

FoundrySteps.displayName = 'FoundrySteps';

// Export sub-component
FoundrySteps.Step = Steps.Step;

export default FoundrySteps;
