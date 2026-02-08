/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Select } from '@arco-design/web-react';
import type { SelectProps } from '@arco-design/web-react';
import type { SelectHandle } from '@arco-design/web-react/es/Select/interface';
import classNames from 'classnames';
import React from 'react';

/**
 * Custom select component props
 */
type NativeSelectProps = Omit<SelectProps, 'size'>;
type NativeSelectSize = NonNullable<SelectProps['size']>;
type FoundrySelectSize = NativeSelectSize | 'middle';

export interface FoundrySelectProps extends NativeSelectProps {
  /** Additional class name */
  className?: string;
  /** Unified size with additional "middle" (32px) */
  size?: FoundrySelectSize;
}

/**
 * Base style class name
 * Note: Theme-related styles (background, border colors) are defined in .foundry-select class in arco-override.css
 */
const BASE_CLASS = classNames('foundry-select', '[&_.arco-select-view]:rounded-[4px]', '[&_.arco-select-view]:border', '[&_.arco-select-view]:border-solid', '[&_.arco-select-view]:border-border-2', '[&_.arco-select-view]:shadow-none', '[&_.arco-select-view]:transition-colors', '[&_.arco-select-view:hover]:border-[var(--color-primary)]', '[&_.arco-select-view:focus-within]:border-[var(--color-primary)]', '[&_.arco-select-view-disabled]:bg-[var(--color-bg-2)]', '[&_.arco-select-view-disabled]:opacity-80');

/**
 * Default popup container getter function
 * Always returns document.body to avoid ResizeObserver loop errors from nested containers
 */
const defaultGetPopupContainer = (): HTMLElement => {
  // Always mount popup to body in browsers to avoid nested-container ResizeObserver loops
  if (typeof document !== 'undefined' && document.body) {
    return document.body;
  }
  // Fallback for SSR/tests - this code path shouldn't render popups
  return undefined as unknown as HTMLElement;
};

/**
 * Custom select component
 *
 * Wrapper around Arco Design Select with unified theme styling and popup handling
 *
 * @features
 * - Auto theme adaptation (light/dark)
 * - Popup mounted to body to avoid layout issues
 * - Unified border radius and border styles
 * - Full Arco Select API support
 *
 * @example
 * ```tsx
 * // Basic usage
 * <FoundrySelect placeholder="Please select" style={{ width: 200 }}>
 *   <FoundrySelect.Option value="1">Option 1</FoundrySelect.Option>
 *   <FoundrySelect.Option value="2">Option 2</FoundrySelect.Option>
 * </FoundrySelect>
 *
 * // Multiple selection
 * <FoundrySelect mode="multiple" placeholder="Select multiple">
 *   <FoundrySelect.Option value="1">Option 1</FoundrySelect.Option>
 *   <FoundrySelect.Option value="2">Option 2</FoundrySelect.Option>
 * </FoundrySelect>
 *
 * // Grouped options
 * <FoundrySelect placeholder="Please select">
 *   <FoundrySelect.OptGroup label="Group 1">
 *     <FoundrySelect.Option value="1">Option 1</FoundrySelect.Option>
 *   </FoundrySelect.OptGroup>
 *   <FoundrySelect.OptGroup label="Group 2">
 *     <FoundrySelect.Option value="2">Option 2</FoundrySelect.Option>
 *   </FoundrySelect.OptGroup>
 * </FoundrySelect>
 * ```
 *
 * @see arco-override.css for theme-related styles (.foundry-select)
 */
const mapSizeToNative = (size?: FoundrySelectSize): NativeSelectSize | undefined => {
  if (!size) return undefined;
  if (size === 'middle') return 'default';
  return size;
};

type FoundrySelectComponent = React.ForwardRefExoticComponent<FoundrySelectProps & React.RefAttributes<SelectHandle>> & {
  Option: typeof Select.Option;
  OptGroup: typeof Select.OptGroup;
};

const InternalSelect = React.forwardRef<SelectHandle, FoundrySelectProps>(({ className, getPopupContainer, size = 'middle', ...rest }, ref) => {
  const normalizedSize = mapSizeToNative(size);
  return <Select ref={ref} size={normalizedSize} className={classNames(BASE_CLASS, className)} getPopupContainer={getPopupContainer || defaultGetPopupContainer} {...rest} />;
});

const FoundrySelect = InternalSelect as FoundrySelectComponent;

FoundrySelect.displayName = 'FoundrySelect';

// Export sub-components
FoundrySelect.Option = Select.Option;
FoundrySelect.OptGroup = Select.OptGroup;

export default FoundrySelect;
