/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Foundry application shared constants
 */

// ===== File handling related constants =====

/** Temporary file timestamp separator */
export const FOUNDRY_TIMESTAMP_SEPARATOR = '_foundry_';

/** Regex for matching and cleaning timestamp suffix */
export const FOUNDRY_TIMESTAMP_REGEX = /_foundry_\d{13}(\.\w+)?$/;
export const FOUNDRY_FILES_MARKER = '[[FOUNDRY_FILES]]';

// ===== Media type related constants =====

/** Supported image file extensions */
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg'] as const;

/** File extension to MIME type mapping */
export const MIME_TYPE_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.svg': 'image/svg+xml',
};

/** MIME type to file extension mapping */
export const MIME_TO_EXT_MAP: Record<string, string> = {
  jpeg: '.jpg',
  jpg: '.jpg',
  png: '.png',
  gif: '.gif',
  webp: '.webp',
  bmp: '.bmp',
  tiff: '.tiff',
  'svg+xml': '.svg',
};

/** Default image file extension */
export const DEFAULT_IMAGE_EXTENSION = '.png';
