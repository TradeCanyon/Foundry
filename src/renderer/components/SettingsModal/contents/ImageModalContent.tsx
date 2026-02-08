/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConfigStorage, type IConfigStorageRefer } from '@/common/storage';
import { Divider, Form, Switch, Message } from '@arco-design/web-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useConfigModelListWithImage from '@/renderer/hooks/useConfigModelListWithImage';
import FoundrySelect from '@/renderer/components/base/FoundrySelect';
import { useSettingsViewMode } from '../settingsViewContext';

/** Gemini native image models available when a Gemini API key is present */
const GEMINI_NATIVE_MODELS = [
  { value: 'gemini-2.5-flash-preview-image-generation', label: 'Gemini 2.5 Flash (Fast)' },
  { value: 'gemini-2.0-flash-preview-image-generation', label: 'Gemini 2.0 Flash' },
] as const;

const DEFAULT_NATIVE_MODEL = GEMINI_NATIVE_MODELS[0].value;

const ImageModalContent: React.FC = () => {
  const { t } = useTranslation();
  const [imageGenerationModel, setImageGenerationModel] = useState<IConfigStorageRefer['tools.imageGenerationModel'] | undefined>();
  const [nativeModel, setNativeModel] = useState<string>(DEFAULT_NATIVE_MODEL);
  const [autoDetected, setAutoDetected] = useState(false);
  const { modelListWithImage: data } = useConfigModelListWithImage();

  const imageGenerationModelList = useMemo(() => {
    if (!data) return [];
    const isImageModel = (modelName: string) => {
      const name = modelName.toLowerCase();
      return name.includes('image') || name.includes('dall-e');
    };
    return (data || [])
      .filter((v) => v.model.some(isImageModel))
      .map((v) => ({
        ...v,
        model: v.model.filter(isImageModel),
      }));
  }, [data]);

  // Check if a Gemini API key exists (for native fallback)
  const hasGeminiApiKey = useMemo(() => {
    if (!data) return false;
    return data.some((p) => p.platform?.toLowerCase().includes('gemini') && p.apiKey);
  }, [data]);

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const imgModel = await ConfigStorage.get('tools.imageGenerationModel');
        if (imgModel) {
          setImageGenerationModel(imgModel);
        } else if (hasGeminiApiKey) {
          // Auto-detect: Gemini API key present but no model configured
          setAutoDetected(true);
        }
      } catch (error) {
        console.error('Failed to load image generation model config:', error);
      }

      try {
        const native = await ConfigStorage.get('tools.imageGenNativeModel');
        if (native) {
          setNativeModel(native);
        }
      } catch {
        // ignore
      }
    };

    void loadConfigs();
  }, [hasGeminiApiKey]);

  // Sync imageGenerationModel apiKey when provider apiKey changes
  useEffect(() => {
    if (!imageGenerationModel || !data) return;

    const currentProvider = data.find((p) => p.id === imageGenerationModel.id);

    if (currentProvider && currentProvider.apiKey !== imageGenerationModel.apiKey) {
      const updatedModel = {
        ...imageGenerationModel,
        apiKey: currentProvider.apiKey,
      };

      setImageGenerationModel(updatedModel);
      ConfigStorage.set('tools.imageGenerationModel', updatedModel).catch((error) => {
        console.error('Failed to save image generation model config:', error);
      });
    } else if (!currentProvider) {
      setImageGenerationModel(undefined);
      ConfigStorage.remove('tools.imageGenerationModel').catch((error) => {
        console.error('Failed to remove image generation model config:', error);
      });
    }
  }, [data, imageGenerationModel?.id, imageGenerationModel?.apiKey]);

  const handleImageGenerationModelChange = useCallback((value: Partial<IConfigStorageRefer['tools.imageGenerationModel']>) => {
    setImageGenerationModel((prev) => {
      const newImageGenerationModel = { ...prev, ...value };
      ConfigStorage.set('tools.imageGenerationModel', newImageGenerationModel).catch((error) => {
        console.error('Failed to update image generation model config:', error);
      });
      return newImageGenerationModel;
    });
    setAutoDetected(false);
  }, []);

  const handleNativeModelChange = useCallback((value: string) => {
    setNativeModel(value);
    ConfigStorage.set('tools.imageGenNativeModel', value).catch((error) => {
      console.error('Failed to save native model preference:', error);
    });
  }, []);

  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  return (
    <div className='flex flex-col h-full w-full'>
      <div className='space-y-16px'>
        {/* Provider-based Image Generation */}
        <div className='px-[12px] md:px-[32px] py-[24px] bg-2 rd-12px md:rd-16px border border-border-2'>
          <div className='flex items-center justify-between mb-16px'>
            <span className='text-14px text-t-primary'>{t('settings.imageGeneration')}</span>
            <Switch disabled={!imageGenerationModelList.length || !imageGenerationModel?.useModel} checked={imageGenerationModel?.switch} onChange={(checked) => handleImageGenerationModelChange({ switch: checked })} />
          </div>

          <Divider className='mt-0px mb-20px' />

          <Form layout='horizontal' labelAlign='left' className='space-y-12px'>
            <Form.Item label={t('settings.imageGenerationModel')}>
              {imageGenerationModelList.length > 0 ? (
                <FoundrySelect
                  value={imageGenerationModel?.id && imageGenerationModel?.useModel ? `${imageGenerationModel.id}|${imageGenerationModel.useModel}` : undefined}
                  placeholder={t('settings.imageSelectModel')}
                  onChange={(value) => {
                    const [platformId, modelName] = value.split('|');
                    const platform = imageGenerationModelList.find((p) => p.id === platformId);
                    if (platform) {
                      handleImageGenerationModelChange({ ...platform, useModel: modelName, switch: true });
                    }
                  }}
                >
                  {imageGenerationModelList.map(({ model, ...platform }) => (
                    <FoundrySelect.OptGroup label={platform.name} key={platform.id}>
                      {model.map((modelName) => (
                        <FoundrySelect.Option key={platform.id + modelName} value={platform.id + '|' + modelName}>
                          {modelName}
                        </FoundrySelect.Option>
                      ))}
                    </FoundrySelect.OptGroup>
                  ))}
                </FoundrySelect>
              ) : (
                <div className='text-t-secondary text-13px'>{t('settings.noAvailable')}</div>
              )}
            </Form.Item>
          </Form>
        </div>

        {/* Gemini Native Image Generation (fallback) */}
        {hasGeminiApiKey && (
          <div className='px-[12px] md:px-[32px] py-[24px] bg-2 rd-12px md:rd-16px border border-border-2'>
            <div className='flex items-center justify-between mb-16px'>
              <span className='text-14px text-t-primary'>{t('settings.imageNativeTitle')}</span>
            </div>

            {autoDetected && <div className='mb-12px px-12px py-8px bg-fill-1 rd-8px text-13px text-t-secondary'>{t('settings.imageAutoDetected')}</div>}

            <Divider className='mt-0px mb-20px' />

            <Form layout='horizontal' labelAlign='left' className='space-y-12px'>
              <Form.Item label={t('settings.imageNativeModel')}>
                <FoundrySelect value={nativeModel} onChange={handleNativeModelChange}>
                  {GEMINI_NATIVE_MODELS.map((m) => (
                    <FoundrySelect.Option key={m.value} value={m.value}>
                      {m.label}
                    </FoundrySelect.Option>
                  ))}
                </FoundrySelect>
              </Form.Item>
            </Form>

            <div className='mt-12px text-12px text-t-tertiary'>{t('settings.imageNativeDesc')}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageModalContent;
