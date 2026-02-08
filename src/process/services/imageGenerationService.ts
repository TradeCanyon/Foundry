/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import type { TProviderWithModel } from '@/common/storage';
import type { ImageProviderStatus } from '@/common/ipcBridge';
import { ClientFactory } from '@/common/ClientFactory';
import { OpenAIRotatingClient } from '@/common/adapters/OpenAIRotatingClient';
import { IMAGE_EXTENSIONS, MIME_TYPE_MAP, MIME_TO_EXT_MAP, DEFAULT_IMAGE_EXTENSION } from '@/common/constants';
import * as fs from 'fs';
import * as path from 'path';
import { ProcessConfig } from '@/process/initStorage';

export interface ImageGenerationRequest {
  prompt: string;
  referenceImages?: string[];
  outputDir: string;
}

export interface ImageGenerationResult {
  success: boolean;
  imagePath?: string;
  relativePath?: string;
  textResponse?: string;
  error?: string;
}

function getFileExtensionFromMime(mimeType: string): string {
  const mime = mimeType.replace('image/', '').toLowerCase();
  return MIME_TO_EXT_MAP[mime] || DEFAULT_IMAGE_EXTENSION;
}

function getImageMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPE_MAP[ext] || MIME_TYPE_MAP[DEFAULT_IMAGE_EXTENSION];
}

async function saveImage(base64Data: string, mimeType: string, outputDir: string): Promise<string> {
  const timestamp = Date.now();
  const ext = getFileExtensionFromMime(mimeType);
  const fileName = `img-${timestamp}${ext}`;
  const filePath = path.join(outputDir, fileName);

  const imageBuffer = Buffer.from(base64Data, 'base64');
  await fs.promises.writeFile(filePath, imageBuffer);

  return filePath;
}

/**
 * Standalone image generation service for the "New Image" flow.
 * Runs in the main process — no worker fork needed.
 */
export class ImageGenerationService {
  /**
   * Generate image using Gemini native API
   */
  static async generateWithGeminiNative(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    // Get Gemini API key
    const apiKey = await ImageGenerationService.getGeminiApiKey();
    if (!apiKey) {
      return { success: false, error: 'No Gemini API key configured.' };
    }

    // Get configured native model
    const nativeModel = (await ProcessConfig.get('tools.imageGenNativeModel')) || 'gemini-2.5-flash-preview-image-generation';

    const client = new GoogleGenAI({ apiKey });

    try {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      // Add reference images if provided
      if (request.referenceImages && request.referenceImages.length > 0) {
        for (const imgPath of request.referenceImages) {
          const fullPath = path.isAbsolute(imgPath) ? imgPath : path.resolve(request.outputDir, imgPath);
          const buffer = await fs.promises.readFile(fullPath);
          const mimeType = getImageMimeType(fullPath);
          parts.push({ inlineData: { mimeType, data: buffer.toString('base64') } });
        }
      }

      parts.push({ text: request.prompt });

      const response = await client.models.generateContent({
        model: nativeModel,
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      });

      const responseParts = response.candidates?.[0]?.content?.parts;
      if (!responseParts) {
        return { success: false, error: 'No response from Gemini. Prompt may have been blocked by safety filters.' };
      }

      let imageBytes: string | undefined;
      let imageMimeType = 'image/png';
      let textResponse = '';

      for (const part of responseParts) {
        if (part.inlineData?.data) {
          imageBytes = part.inlineData.data;
          imageMimeType = part.inlineData.mimeType || 'image/png';
        } else if (part.text) {
          textResponse += part.text;
        }
      }

      if (!imageBytes) {
        return { success: true, textResponse: textResponse || 'No image was generated.' };
      }

      const imagePath = await saveImage(imageBytes, imageMimeType, request.outputDir);
      const relativePath = path.relative(request.outputDir, imagePath);

      return {
        success: true,
        imagePath,
        relativePath,
        textResponse: textResponse || undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Generate image using a configured provider (OpenAI-compatible)
   */
  static async generateWithProvider(request: ImageGenerationRequest, provider: TProviderWithModel): Promise<ImageGenerationResult> {
    try {
      const client = await ClientFactory.createRotatingClient(provider, {
        rotatingOptions: { maxRetries: 3, retryDelay: 1000 },
      });

      // OpenAI dall-e / gpt-image models need the Images API, not chat completions
      const modelLower = provider.useModel.toLowerCase();
      const isOpenAIImageModel = modelLower.startsWith('dall-e') || modelLower.startsWith('gpt-image');

      if (isOpenAIImageModel && client instanceof OpenAIRotatingClient) {
        return await ImageGenerationService.generateWithOpenAIImagesAPI(request, client, provider.useModel);
      }

      // All other providers (OpenRouter, Gemini, etc.) — use chat completions
      const completion = await client.createChatCompletion(
        {
          model: provider.useModel,
          messages: [{ role: 'user', content: request.prompt }] as any,
        },
        { timeout: 120000 }
      );

      const choice = completion.choices[0];
      if (!choice) {
        return { success: false, error: 'No response from image generation API.' };
      }

      const responseText = choice.message.content || '';
      const images = (choice.message as any).images as Array<{ type: string; image_url?: { url: string } }> | undefined;

      if (!images || images.length === 0) {
        return { success: true, textResponse: responseText || 'No image was generated.' };
      }

      const firstImage = images[0];
      if (firstImage.type === 'image_url' && firstImage.image_url?.url) {
        const dataUrl = firstImage.image_url.url;
        const base64Data = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
        const mimeMatch = dataUrl.match(/^data:(image\/[^;]+);base64,/);
        const mimeType = mimeMatch?.[1] || 'image/png';

        const imagePath = await saveImage(base64Data, mimeType, request.outputDir);
        const relativePath = path.relative(request.outputDir, imagePath);

        return { success: true, imagePath, relativePath, textResponse: responseText || undefined };
      }

      return { success: true, textResponse: responseText || 'No image was generated.' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Generate image using OpenAI Images API (for dall-e-3, gpt-image-1, etc.)
   */
  private static async generateWithOpenAIImagesAPI(request: ImageGenerationRequest, client: OpenAIRotatingClient, model: string): Promise<ImageGenerationResult> {
    const response = await client.createImage({
      model,
      prompt: request.prompt,
      n: 1,
      response_format: 'b64_json',
    });

    const imageData = response.data?.[0];
    if (!imageData?.b64_json) {
      return { success: false, error: 'No image data returned from OpenAI Images API.' };
    }

    const imagePath = await saveImage(imageData.b64_json, 'image/png', request.outputDir);
    const relativePath = path.relative(request.outputDir, imagePath);

    return {
      success: true,
      imagePath,
      relativePath,
      textResponse: imageData.revised_prompt || undefined,
    };
  }

  /**
   * Auto-detect the best available image generation provider.
   * Priority: 1) Configured provider model  2) Gemini native  3) Unavailable
   */
  static async getAvailableProvider(): Promise<ImageProviderStatus> {
    // 1. Check configured provider model
    try {
      const imgConfig = await ProcessConfig.get('tools.imageGenerationModel');
      if (imgConfig?.switch && imgConfig?.apiKey && imgConfig?.useModel) {
        return {
          available: true,
          method: 'provider',
          provider: imgConfig as TProviderWithModel,
        };
      }
    } catch {
      // Continue to next check
    }

    // 2. Check Gemini API key
    const geminiKey = await ImageGenerationService.getGeminiApiKey();
    if (geminiKey) {
      const nativeModel = (await ProcessConfig.get('tools.imageGenNativeModel')) || 'gemini-2.5-flash-preview-image-generation';
      return { available: true, method: 'native', nativeModel };
    }

    // 3. Nothing available
    return { available: false, reason: 'No image generation provider configured. Add a Gemini API key or configure an image model in Settings > Image.' };
  }

  /**
   * Generate an image using the best available provider (auto-detected).
   */
  static async generateAutoDetect(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const status = await ImageGenerationService.getAvailableProvider();
    if (status.available === false) {
      return { success: false, error: status.reason };
    }
    if (status.method === 'provider') {
      return ImageGenerationService.generateWithProvider(request, status.provider);
    }
    return ImageGenerationService.generateWithGeminiNative(request);
  }

  static async getGeminiApiKey(): Promise<string | undefined> {
    const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (envKey) return envKey;
    try {
      const modelConfig = await ProcessConfig.get('model.config');
      const geminiProvider = modelConfig?.find((p: any) => p.platform?.toLowerCase().includes('gemini') && p.apiKey);
      return geminiProvider?.apiKey;
    } catch {
      return undefined;
    }
  }
}
