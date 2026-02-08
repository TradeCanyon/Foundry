/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Foundry base components unified exports
 *
 * Provides unified export entry for all base components and types
 */

// ==================== Component Exports ====================

export { default as FoundryModal } from './FoundryModal';
export { default as FoundryCollapse } from './FoundryCollapse';
export { default as FoundrySelect } from './FoundrySelect';
export { default as FoundryScrollArea } from './FoundryScrollArea';
export { default as FoundrySteps } from './FoundrySteps';

// ==================== Type Exports ====================

// FoundryModal types
export type { ModalSize, ModalHeaderConfig, ModalFooterConfig, ModalContentStyleConfig, FoundryModalProps } from './FoundryModal';
export { MODAL_SIZES } from './FoundryModal';

// FoundryCollapse types
export type { FoundryCollapseProps, FoundryCollapseItemProps } from './FoundryCollapse';

// FoundrySelect types
export type { FoundrySelectProps } from './FoundrySelect';

// FoundrySteps types
export type { FoundryStepsProps } from './FoundrySteps';
