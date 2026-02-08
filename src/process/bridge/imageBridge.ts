/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ImageGenerationService } from '../services/imageGenerationService';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

function getDefaultOutputDir(): string {
  const dir = path.join(app.getPath('userData'), 'generated-images');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function initImageBridge(): void {
  // Status check — auto-detect best available provider
  ipcBridge.image.getStatus.provider(async () => {
    try {
      const status = await ImageGenerationService.getAvailableProvider();
      return { success: true, data: status };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, msg };
    }
  });

  // Generate — auto-detect provider, no caller decision needed
  ipcBridge.image.generate.provider(async ({ prompt, outputDir, referenceImages }) => {
    try {
      const resolvedOutputDir = outputDir || getDefaultOutputDir();
      const result = await ImageGenerationService.generateAutoDetect({ prompt, referenceImages, outputDir: resolvedOutputDir });

      if (!result.success) {
        return { success: false, msg: result.error };
      }

      return {
        success: true,
        data: {
          imagePath: result.imagePath,
          relativePath: result.relativePath,
          textResponse: result.textResponse,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, msg: errorMessage };
    }
  });
}
