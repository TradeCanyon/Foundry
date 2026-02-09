import { useMemo } from 'react';
import useSWR from 'swr';
import { ipcBridge } from '../../common';

/** Well-known image model IDs injected when a platform has none */
const OPENROUTER_IMAGE_MODEL = 'google/gemini-2.5-flash-image:free';
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

const useConfigModelListWithImage = () => {
  const { data } = useSWR('configModelListWithImage', () => {
    return ipcBridge.mode.getModelConfig.invoke();
  });

  const modelListWithImage = useMemo(() => {
    return (data || []).map((platform) => {
      const hasImageModel = platform.model.some((m) => {
        const lower = m.toLowerCase();
        return lower.includes('image') || lower.includes('dall-e');
      });
      if (hasImageModel) return platform;

      // Inject a known image model for platforms that support it — clone to avoid mutating SWR cache
      const lowerPlatform = platform.platform?.toLowerCase() ?? '';

      if (lowerPlatform === 'openrouter' || platform.baseUrl?.includes('openrouter.ai')) {
        return { ...platform, model: [...platform.model, OPENROUTER_IMAGE_MODEL] };
      }

      if (lowerPlatform.includes('gemini')) {
        return { ...platform, model: [...platform.model, GEMINI_IMAGE_MODEL] };
      }

      return platform;
    });
  }, [data]);

  return {
    modelListWithImage,
  };
};

export default useConfigModelListWithImage;
