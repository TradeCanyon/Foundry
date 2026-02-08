import { ipcBridge } from '@/common';
import type { IProvider, TProviderWithModel } from '@/common/storage';
import { useGeminiGoogleAuthModels } from '@/renderer/hooks/useGeminiGoogleAuthModels';
import type { GeminiModeOption } from '@/renderer/hooks/useModeModeList';
import { hasSpecificModelCapability } from '@/renderer/utils/modelCapabilities';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

export interface GeminiModelSelection {
  currentModel?: TProviderWithModel;
  providers: IProvider[];
  geminiModeLookup: Map<string, GeminiModeOption>;
  formatModelLabel: (provider?: { platform?: string }, modelName?: string) => string;
  getDisplayModelName: (modelName?: string) => string;
  getAvailableModels: (provider: IProvider) => string[];
  handleSelectModel: (provider: IProvider, modelName: string) => Promise<void>;
}

/**
 * Convert raw API model names to human-friendly labels.
 * e.g. "claude-opus-4-5-2025" → "Claude Opus 4.5"
 *      "gpt-4o-2024-05-13" → "GPT-4o"
 *      "gemini-2.0-flash" → "Gemini 2.0 Flash"
 */
function prettifyModelName(name: string): string {
  // Strip date suffixes (e.g. -20250929, -2025, -2024-05-13)
  let clean = name.replace(/-\d{4,}(-\d{2}(-\d{2})?)?$/, '');
  // Convert hyphens to spaces and capitalize each word
  clean = clean
    .split('-')
    .map((word) => {
      // Keep known abbreviations uppercase
      if (/^gpt$/i.test(word)) return 'GPT';
      if (/^o\d+$/i.test(word)) return word; // o1, o3, etc.
      // Version-like segments (e.g. "4", "4o", "2.0"): keep as-is
      if (/^\d/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
  // Collapse version parts: "4 5" → "4.5" when preceded by a model family name
  clean = clean.replace(/(\d+)\s+(\d+)(?!\.\d)/, '$1.$2');
  return clean;
}

// Centralize model selection logic for reuse across header and send box
export const useGeminiModelSelection = (conversationId: string | undefined, initialModel: TProviderWithModel | undefined): GeminiModelSelection => {
  const [currentModel, setCurrentModel] = useState<TProviderWithModel | undefined>(initialModel);

  useEffect(() => {
    setCurrentModel(initialModel);
  }, [initialModel?.id, initialModel?.useModel]);

  const { geminiModeOptions, isGoogleAuth } = useGeminiGoogleAuthModels();

  const geminiModeLookup = useMemo(() => {
    const lookup = new Map<string, GeminiModeOption>();
    geminiModeOptions.forEach((option) => lookup.set(option.value, option));
    return lookup;
  }, [geminiModeOptions]);

  const { data: modelConfig } = useSWR('model.config.sendbox', () => ipcBridge.mode.getModelConfig.invoke());

  // Use useRef for mutable cache that persists across renders
  const availableModelsCacheRef = useRef(new Map<string, string[]>());

  const getAvailableModels = useCallback((provider: IProvider): string[] => {
    const cacheKey = `${provider.id}-${(provider.model || []).join(',')}`;
    const cache = availableModelsCacheRef.current;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }
    const result: string[] = [];
    for (const modelName of provider.model || []) {
      const functionCalling = hasSpecificModelCapability(provider, modelName, 'function_calling');
      const excluded = hasSpecificModelCapability(provider, modelName, 'excludeFromPrimary');
      if ((functionCalling === true || functionCalling === undefined) && excluded !== true) {
        result.push(modelName);
      }
    }
    cache.set(cacheKey, result);
    return result;
  }, []);

  const providers = useMemo(() => {
    // Dynamically build provider list when Google Auth provider is available
    let list: IProvider[] = Array.isArray(modelConfig) ? modelConfig : [];
    if (isGoogleAuth) {
      const googleProvider: IProvider = {
        id: 'google-auth-gemini',
        name: 'Gemini Google Auth',
        platform: 'gemini-with-google-auth',
        baseUrl: '',
        apiKey: '',
        model: geminiModeOptions.map((v) => v.value),
        capabilities: [{ type: 'text' }, { type: 'vision' }, { type: 'function_calling' }],
      } as unknown as IProvider;
      list = [googleProvider, ...list];
    }
    return list.filter((p) => getAvailableModels(p).length > 0);
  }, [geminiModeOptions, getAvailableModels, isGoogleAuth, modelConfig]);

  const handleSelectModel = useCallback(
    async (provider: IProvider, modelName: string) => {
      if (!conversationId) return;
      const selected: TProviderWithModel = { ...(provider as unknown as TProviderWithModel), useModel: modelName };
      const ok = await ipcBridge.conversation.update.invoke({ id: conversationId, updates: { model: selected } });
      if (ok) {
        setCurrentModel(selected);
      }
    },
    [conversationId]
  );

  const formatModelLabel = useCallback(
    (provider: { platform?: string } | undefined, modelName?: string) => {
      if (!modelName) return '';
      const isGoogleAuthProvider = provider?.platform?.toLowerCase().includes('gemini-with-google-auth');
      if (isGoogleAuthProvider) {
        return geminiModeLookup.get(modelName)?.label || modelName;
      }
      // Prettify common API model names for non-Google-Auth providers
      return prettifyModelName(modelName);
    },
    [geminiModeLookup]
  );

  const getDisplayModelName = useCallback(
    (modelName?: string) => {
      if (!modelName) return '';
      const label = formatModelLabel(currentModel, modelName);
      const maxLength = 20;
      return label.length > maxLength ? `${label.slice(0, maxLength)}...` : label;
    },
    [currentModel, formatModelLabel]
  );

  return {
    currentModel,
    providers,
    geminiModeLookup,
    formatModelLabel,
    getDisplayModelName,
    getAvailableModels,
    handleSelectModel,
  };
};
