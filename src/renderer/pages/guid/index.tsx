/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ASSISTANT_PRESETS } from '@/common/presets/assistantPresets';
import type { IProvider, TProviderWithModel } from '@/common/storage';
import { ConfigStorage } from '@/common/storage';
import { resolveLocaleKey, uuid } from '@/common/utils';
import coworkSvg from '@/renderer/assets/cowork.svg';
import { AGENT_LOGO_MAP } from '@/renderer/utils/agentLogos';
import ClaudeCliPrompt from '@/renderer/components/ClaudeCliPrompt';
import FilePreview from '@/renderer/components/FilePreview';
import { useLayoutContext } from '@/renderer/context/LayoutContext';
import { useCompositionInput } from '@/renderer/hooks/useCompositionInput';
import { useDragUpload } from '@/renderer/hooks/useDragUpload';
import { useSendBoxAutocomplete } from '@/renderer/hooks/useSendBoxAutocomplete';
import SendBoxAutocomplete from '@/renderer/components/SendBoxAutocomplete';
import { useGeminiGoogleAuthModels } from '@/renderer/hooks/useGeminiGoogleAuthModels';
import { useInputFocusRing } from '@/renderer/hooks/useInputFocusRing';
import { usePasteService } from '@/renderer/hooks/usePasteService';
import { useConversationTabs } from '@/renderer/pages/conversation/context/ConversationTabsContext';
import { allSupportedExts, type FileMetadata, getCleanFileNames } from '@/renderer/services/FileService';
import { iconColors } from '@/renderer/theme/colors';
import { emitter } from '@/renderer/utils/emitter';
import { buildDisplayMessage } from '@/renderer/utils/messageFiles';
import { hasSpecificModelCapability } from '@/renderer/utils/modelCapabilities';
import { updateWorkspaceTime } from '@/renderer/utils/workspaceHistory';
import { isAcpRoutedPresetType, type AcpBackend, type AcpBackendConfig, type PresetAgentType } from '@/types/acpTypes';
import { Button, ConfigProvider, Dropdown, Input, Menu, Tooltip } from '@arco-design/web-react';
import { IconClose } from '@arco-design/web-react/icon';
import { ArrowUp, Down, FolderOpen, Plus, Robot, UploadOne } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import ProjectCard from '@/renderer/components/ProjectCard';
import type { IProjectInfo } from '@/common/ipcBridge';
import styles from './index.module.css';

/**
 * Cache available models per provider to avoid redundant calculations
 */
const availableModelsCache = new Map<string, string[]>();

/**
 * Get all available primary models for a provider (with caching)
 * @param provider - Provider configuration
 * @returns Array of available primary model names
 */
const getAvailableModels = (provider: IProvider): string[] => {
  // Generate cache key including model list to detect changes
  const cacheKey = `${provider.id}-${(provider.model || []).join(',')}`;

  // Check cache
  if (availableModelsCache.has(cacheKey)) {
    return availableModelsCache.get(cacheKey)!;
  }

  // Calculate available models
  const result: string[] = [];
  for (const modelName of provider.model || []) {
    const functionCalling = hasSpecificModelCapability(provider, modelName, 'function_calling');
    const excluded = hasSpecificModelCapability(provider, modelName, 'excludeFromPrimary');

    if ((functionCalling === true || functionCalling === undefined) && excluded !== true) {
      result.push(modelName);
    }
  }

  // Cache result
  availableModelsCache.set(cacheKey, result);
  return result;
};

/**
 * Check if a provider has available primary conversation models (efficient version)
 * @param provider - Provider configuration
 * @returns true if provider has available models, false otherwise
 */
const hasAvailableModels = (provider: IProvider): boolean => {
  // Use cached result directly to avoid redundant calculation
  const availableModels = getAvailableModels(provider);
  return availableModels.length > 0;
};

/**
 * Measure vertical coordinate at a specific position in textarea
 * @param textarea - Target textarea element
 * @param position - Text position
 * @returns Vertical pixel coordinate at that position
 */
const measureCaretTop = (textarea: HTMLTextAreaElement, position: number): number => {
  const textBefore = textarea.value.slice(0, position);
  const measure = document.createElement('div');
  const style = getComputedStyle(textarea);
  measure.style.cssText = `
    position: absolute;
    visibility: hidden;
    white-space: pre-wrap;
    word-wrap: break-word;
    width: ${textarea.clientWidth}px;
    font: ${style.font};
    line-height: ${style.lineHeight};
    padding: ${style.padding};
    border: ${style.border};
    box-sizing: ${style.boxSizing};
  `;
  measure.textContent = textBefore;
  document.body.appendChild(measure);
  const caretTop = measure.scrollHeight;
  document.body.removeChild(measure);
  return caretTop;
};

/**
 * Scroll textarea to position caret at the last visible line
 * @param textarea - Target textarea element
 * @param caretTop - Vertical coordinate of the caret
 */
const scrollCaretToLastLine = (textarea: HTMLTextAreaElement, caretTop: number): void => {
  const style = getComputedStyle(textarea);
  const lineHeight = parseInt(style.lineHeight, 10) || 20;
  // Scroll to position caret at the last visible line
  textarea.scrollTop = Math.max(0, caretTop - textarea.clientHeight + lineHeight);
};

const useModelList = () => {
  const { geminiModeOptions, isGoogleAuth } = useGeminiGoogleAuthModels();
  const { data: modelConfig } = useSWR('model.config.welcome', () => {
    return ipcBridge.mode.getModelConfig.invoke().then((data) => {
      return (data || []).filter((platform) => !!platform.model.length);
    });
  });

  const geminiModelValues = useMemo(() => geminiModeOptions.map((option) => option.value), [geminiModeOptions]);

  const modelList = useMemo(() => {
    let allProviders: IProvider[] = [];

    if (isGoogleAuth) {
      const geminiProvider: IProvider = {
        id: uuid(),
        name: 'Gemini Google Auth',
        platform: 'gemini-with-google-auth',
        baseUrl: '',
        apiKey: '',
        model: geminiModelValues,
        capabilities: [{ type: 'text' }, { type: 'vision' }, { type: 'function_calling' }],
      };
      allProviders = [geminiProvider, ...(modelConfig || [])];
    } else {
      allProviders = modelConfig || [];
    }

    // Filter providers that have available primary models
    return allProviders.filter(hasAvailableModels);
  }, [geminiModelValues, isGoogleAuth, modelConfig]);

  return { modelList, isGoogleAuth, geminiModeOptions };
};

const CUSTOM_AVATAR_IMAGE_MAP: Record<string, string> = {
  'cowork.svg': coworkSvg,
  '🛠️': coworkSvg,
};

const Guid: React.FC = () => {
  const { t, i18n } = useTranslation();
  const guidContainerRef = useRef<HTMLDivElement>(null);
  const { closeAllTabs, openTab } = useConversationTabs();
  const { activeBorderColor, inactiveBorderColor, activeShadow } = useInputFocusRing();
  const localeKey = resolveLocaleKey(i18n.language);

  const location = useLocation();
  const [input, setInput] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSelectorVisible, setMentionSelectorVisible] = useState(false);
  const [mentionSelectorOpen, setMentionSelectorOpen] = useState(false);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [dir, setDir] = useState<string>('');
  const [currentModel, _setCurrentModel] = useState<TProviderWithModel>();
  const [isInputFocused, setIsInputFocused] = useState(false);
  const isInputActive = isInputFocused;

  // Fetch projects for home page cards
  const { data: projectsData } = useSWR('projects-list', () => ipcBridge.project.list.invoke());
  const projects = (projectsData?.success ? projectsData.data : []) || [];

  // Read workspace, mode, and agent from location.state (passed from tabs add button or sidebar)
  useEffect(() => {
    const state = location.state as { workspace?: string; mode?: string; agent?: string } | null;
    if (state?.workspace) {
      setDir(state.workspace);
    }
    if (state?.mode === 'image') {
      setSelectedAgentKey('image');
    }
    if (state?.agent === 'ember') {
      setSelectedAgentKey('ember');
    }
  }, [location.state]);
  const { modelList, isGoogleAuth, geminiModeOptions } = useModelList();
  const geminiModeLookup = useMemo(() => {
    const lookup = new Map<string, (typeof geminiModeOptions)[number]>();
    geminiModeOptions.forEach((option) => lookup.set(option.value, option));
    return lookup;
  }, [geminiModeOptions]);
  const formatGeminiModelLabel = useCallback(
    (provider: { platform?: string } | undefined, modelName?: string) => {
      if (!modelName) return '';
      const isGoogleProvider = provider?.platform?.toLowerCase().includes('gemini-with-google-auth');
      if (isGoogleProvider) {
        return geminiModeLookup.get(modelName)?.label || modelName;
      }
      return modelName;
    },
    [geminiModeLookup]
  );
  // Track current selected provider+model to check availability on list refresh
  const selectedModelKeyRef = useRef<string | null>(null);
  // Support Codex (MCP) option on init page, UI placeholder for now
  // For custom agents, we store "custom:uuid" format to distinguish between multiple custom agents
  const [selectedAgentKey, _setSelectedAgentKey] = useState<string>('gemini');

  // Wrap setSelectedAgentKey to also save to storage
  const setSelectedAgentKey = useCallback((key: string) => {
    _setSelectedAgentKey(key);
    // Save selection to storage
    ConfigStorage.set('guid.lastSelectedAgent', key).catch((error) => {
      console.error('Failed to save selected agent:', error);
    });
  }, []);
  const [availableAgents, setAvailableAgents] = useState<
    Array<{
      backend: AcpBackend;
      name: string;
      cliPath?: string;
      customAgentId?: string;
      isPreset?: boolean;
      context?: string;
      avatar?: string;
      presetAgentType?: PresetAgentType;
    }>
  >();
  const [customAgents, setCustomAgents] = useState<AcpBackendConfig[]>([]);

  /**
   * Helper to get agent key for selection
   * Returns "custom:uuid" for custom agents, backend type for others
   */
  const getAgentKey = (agent: { backend: AcpBackend; customAgentId?: string }) => {
    return agent.backend === 'custom' && agent.customAgentId ? `custom:${agent.customAgentId}` : agent.backend;
  };

  /**
   * Helper to find agent by key
   * Supports both "custom:uuid" format and plain backend type
   */
  const findAgentByKey = (key: string) => {
    if (key.startsWith('custom:')) {
      const customAgentId = key.slice(7);
      // First check availableAgents
      const foundInAvailable = availableAgents?.find((a) => a.backend === 'custom' && a.customAgentId === customAgentId);
      if (foundInAvailable) return foundInAvailable;

      // Then check customAgents for presets
      const assistant = customAgents.find((a) => a.id === customAgentId);
      if (assistant) {
        return {
          backend: 'custom' as AcpBackend,
          name: assistant.name,
          customAgentId: assistant.id,
          isPreset: true,
          context: '', // Context loaded via other means
          avatar: assistant.avatar,
        };
      }
    }
    return availableAgents?.find((a) => a.backend === key);
  };

  // Get the selected backend type (for backward compatibility)
  const selectedAgent = selectedAgentKey.startsWith('custom:') ? 'custom' : (selectedAgentKey as AcpBackend);
  const selectedAgentInfo = useMemo(() => findAgentByKey(selectedAgentKey), [selectedAgentKey, availableAgents, customAgents]);
  const isPresetAgent = Boolean(selectedAgentInfo?.isPreset);
  const [isPlusDropdownOpen, setIsPlusDropdownOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(true);
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);
  const [typewriterPlaceholder, setTypewriterPlaceholder] = useState('');
  const [_isTyping, setIsTyping] = useState(true);
  const mentionMatchRegex = useMemo(() => /(?:^|\s)@([^\s@]*)$/, []);

  /**
   * Build a unique key for provider/model pair
   */
  const buildModelKey = (providerId?: string, modelName?: string) => {
    if (!providerId || !modelName) return null;
    return `${providerId}:${modelName}`;
  };

  /**
   * Check if selected model key still exists in the new provider list
   */
  const isModelKeyAvailable = (key: string | null, providers?: IProvider[]) => {
    if (!key || !providers || providers.length === 0) return false;
    return providers.some((provider) => {
      if (!provider.id || !provider.model?.length) return false;
      return provider.model.some((modelName) => buildModelKey(provider.id, modelName) === key);
    });
  };

  const setCurrentModel = async (modelInfo: TProviderWithModel) => {
    // Track latest selected key to prevent incorrect reset on list refresh
    selectedModelKeyRef.current = buildModelKey(modelInfo.id, modelInfo.useModel);
    await ConfigStorage.set('gemini.defaultModel', { id: modelInfo.id, useModel: modelInfo.useModel }).catch((error) => {
      console.error('Failed to save default model:', error);
    });
    _setCurrentModel(modelInfo);
  };
  const navigate = useNavigate();
  const _layout = useLayoutContext();

  // Handle pasted files (replace mode to avoid accumulating old file paths)
  const handleFilesPasted = useCallback((pastedFiles: FileMetadata[]) => {
    const filePaths = pastedFiles.map((file) => file.path);
    // Paste operation replaces existing files instead of appending
    setFiles(filePaths);
    setDir('');
  }, []);

  // Handle files uploaded via dialog (append mode)
  const handleFilesUploaded = useCallback((uploadedPaths: string[]) => {
    setFiles((prevFiles) => [...prevFiles, ...uploadedPaths]);
  }, []);

  const handleRemoveFile = useCallback((targetPath: string) => {
    // Remove files already selected on the welcome screen
    setFiles((prevFiles) => prevFiles.filter((file) => file !== targetPath));
  }, []);

  // Use drag upload hook (drag is treated like paste, replaces existing files)
  const { isFileDragging, dragHandlers } = useDragUpload({
    supportedExts: allSupportedExts,
    onFilesAdded: handleFilesPasted,
  });

  // Use shared PasteService integration (paste replaces existing files)
  const { onPaste, onFocus } = usePasteService({
    supportedExts: allSupportedExts,
    onFilesAdded: handleFilesPasted,
    onTextPaste: (text: string) => {
      // Insert text at cursor position, preserving existing content
      const textarea = document.activeElement as HTMLTextAreaElement | null;
      if (textarea && textarea.tagName === 'TEXTAREA') {
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? start;
        const currentValue = textarea.value;
        const newValue = currentValue.slice(0, start) + text + currentValue.slice(end);
        setInput(newValue);

        setTimeout(() => {
          const newPos = start + text.length;
          textarea.setSelectionRange(newPos, newPos);
          const caretTop = measureCaretTop(textarea, newPos);
          scrollCaretToLastLine(textarea, caretTop);
        }, 0);
      } else {
        setInput((prev) => prev + text);
      }
    },
  });
  const handleTextareaFocus = useCallback(() => {
    onFocus();
    setIsInputFocused(true);
  }, [onFocus]);
  const handleTextareaBlur = useCallback(() => {
    setIsInputFocused(false);
  }, []);

  const customAgentAvatarMap = useMemo(() => {
    return new Map(customAgents.map((agent) => [agent.id, agent.avatar]));
  }, [customAgents]);

  const mentionOptions = useMemo(() => {
    const agents = availableAgents || [];
    const options = agents.map((agent) => {
      const key = getAgentKey(agent);
      const label = agent.name || agent.backend;
      const avatarValue = agent.backend === 'custom' ? agent.avatar || customAgentAvatarMap.get(agent.customAgentId || '') : undefined;
      const avatar = avatarValue ? avatarValue.trim() : undefined;
      const tokens = new Set<string>();
      const normalizedLabel = label.toLowerCase();
      tokens.add(normalizedLabel);
      tokens.add(normalizedLabel.replace(/\s+/g, '-'));
      tokens.add(normalizedLabel.replace(/\s+/g, ''));
      tokens.add(agent.backend.toLowerCase());
      if (agent.customAgentId) {
        tokens.add(agent.customAgentId.toLowerCase());
      }
      return {
        key,
        label,
        tokens,
        avatar,
        avatarImage: avatar ? CUSTOM_AVATAR_IMAGE_MAP[avatar] : undefined,
        logo: AGENT_LOGO_MAP[agent.backend],
      };
    });
    // Add Ember as a built-in mention option
    options.push({
      key: 'ember',
      label: 'Ember',
      tokens: new Set(['ember']),
      avatar: '\u{1F525}',
      avatarImage: undefined,
      logo: undefined,
    });
    return options;
  }, [availableAgents, customAgentAvatarMap]);

  const filteredMentionOptions = useMemo(() => {
    if (!mentionQuery) return mentionOptions;
    const query = mentionQuery.toLowerCase();
    return mentionOptions.filter((option) => Array.from(option.tokens).some((token) => token.startsWith(query)));
  }, [mentionOptions, mentionQuery]);

  const stripMentionToken = useCallback(
    (value: string) => {
      if (!mentionMatchRegex.test(value)) return value;
      return value.replace(mentionMatchRegex, (_match, _query) => '').trimEnd();
    },
    [mentionMatchRegex]
  );

  const selectMentionAgent = useCallback(
    (key: string) => {
      setSelectedAgentKey(key);
      setInput((prev) => stripMentionToken(prev));
      setMentionOpen(false);
      setMentionSelectorOpen(false);
      setMentionSelectorVisible(true);
      setMentionQuery(null);
      setMentionActiveIndex(0);
    },
    [stripMentionToken]
  );

  const selectedAgentLabel = selectedAgentInfo?.name || selectedAgentKey;
  const mentionMenuActiveOption = filteredMentionOptions[mentionActiveIndex] || filteredMentionOptions[0];
  const mentionMenuSelectedKey = mentionOpen || mentionSelectorOpen ? mentionMenuActiveOption?.key || selectedAgentKey : selectedAgentKey;
  const mentionMenuRef = useRef<HTMLDivElement>(null);

  const mentionMenu = useMemo(
    () => (
      <div ref={mentionMenuRef} className='bg-bg-2 border border-[var(--color-border-2)] rd-12px shadow-lg overflow-hidden' style={{ boxShadow: '0 0 0 1px var(--color-border-2), 0 12px 24px rgba(0, 0, 0, 0.12)' }}>
        <Menu selectedKeys={[mentionMenuSelectedKey]} onClickMenuItem={(key) => selectMentionAgent(String(key))} className='min-w-180px max-h-200px overflow-auto'>
          {filteredMentionOptions.length > 0 ? (
            filteredMentionOptions.map((option, index) => (
              <Menu.Item key={option.key} data-mention-index={index}>
                <div className='flex items-center gap-8px'>
                  {option.avatarImage ? <img src={option.avatarImage} alt='' width={16} height={16} style={{ objectFit: 'contain' }} /> : option.avatar ? <span style={{ fontSize: 14, lineHeight: '16px' }}>{option.avatar}</span> : option.logo ? <img src={option.logo} alt={option.label} width={16} height={16} style={{ objectFit: 'contain' }} /> : <Robot theme='outline' size={16} />}
                  <span>{option.label}</span>
                </div>
              </Menu.Item>
            ))
          ) : (
            <Menu.Item key='empty' disabled>
              {t('conversation.welcome.none', { defaultValue: 'None' })}
            </Menu.Item>
          )}
        </Menu>
      </div>
    ),
    [filteredMentionOptions, mentionMenuSelectedKey, selectMentionAgent, t]
  );

  // Get available ACP agents - based on global flags
  const { data: availableAgentsData } = useSWR('acp.agents.available', async () => {
    const result = await ipcBridge.acpConversation.getAvailableAgents.invoke();
    if (result.success) {
      // Filter out detected gemini command, keep only builtin Gemini
      return result.data.filter((agent) => !(agent.backend === 'gemini' && agent.cliPath));
    }
    return [];
  });

  // Update local state
  useEffect(() => {
    if (availableAgentsData) {
      setAvailableAgents(availableAgentsData);
    }
  }, [availableAgentsData]);

  // Load last selected agent
  useEffect(() => {
    if (!availableAgents || availableAgents.length === 0) return;

    let cancelled = false;

    const loadLastSelectedAgent = async () => {
      try {
        const savedAgentKey = await ConfigStorage.get('guid.lastSelectedAgent');
        if (cancelled || !savedAgentKey) return;

        // 1. Check availableAgents first
        const isInAvailable = availableAgents.some((agent) => {
          const key = agent.backend === 'custom' && agent.customAgentId ? `custom:${agent.customAgentId}` : agent.backend;
          return key === savedAgentKey;
        });

        if (isInAvailable) {
          _setSelectedAgentKey(savedAgentKey);
          return;
        }

        // 2. For custom agents, check storage
        if (savedAgentKey.startsWith('custom:')) {
          const customId = savedAgentKey.slice(7);
          const agents = await ConfigStorage.get('acp.customAgents');
          if (cancelled) return;

          if (agents?.some((a: AcpBackendConfig) => a.id === customId)) {
            _setSelectedAgentKey(savedAgentKey);
          }
        }
      } catch (error) {
        console.error('Failed to load last selected agent:', error);
      }
    };

    void loadLastSelectedAgent();

    return () => {
      cancelled = true;
    };
  }, [availableAgents]);

  useEffect(() => {
    let isActive = true;
    ConfigStorage.get('acp.customAgents')
      .then((agents) => {
        if (!isActive) return;
        setCustomAgents(agents || []);
      })
      .catch((error) => {
        console.error('Failed to load custom agents:', error);
      });
    return () => {
      isActive = false;
    };
  }, [availableAgentsData]);

  useEffect(() => {
    if (mentionOpen) {
      setMentionActiveIndex(0);
      return;
    }
    if (mentionSelectorOpen) {
      const selectedIndex = filteredMentionOptions.findIndex((option) => option.key === selectedAgentKey);
      setMentionActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [filteredMentionOptions, mentionOpen, mentionQuery, mentionSelectorOpen, selectedAgentKey]);

  useEffect(() => {
    if (!mentionOpen && !mentionSelectorOpen) return;
    const container = mentionMenuRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-mention-index="${mentionActiveIndex}"]`);
    if (!target) return;
    target.scrollIntoView({ block: 'nearest' });
  }, [mentionActiveIndex, mentionOpen, mentionSelectorOpen]);

  const { compositionHandlers, isComposing } = useCompositionInput();

  // Autocomplete for /commands (guid page handles @mentions separately)
  const slashAutocomplete = useSendBoxAutocomplete(input, setInput, isComposing, isInputFocused);

  /**
   * Resolve preset assistant rules and skills
   *
   * - rules: System rules, injected into userMemory during session initialization
   * - skills: Skill definitions, injected into message prefix on first request
   */
  const resolvePresetRulesAndSkills = useCallback(
    async (agentInfo: { backend: AcpBackend; customAgentId?: string; context?: string } | undefined): Promise<{ rules?: string; skills?: string }> => {
      if (!agentInfo) return {};
      if (agentInfo.backend !== 'custom') {
        return { rules: agentInfo.context };
      }

      const customAgentId = agentInfo.customAgentId;
      if (!customAgentId) return { rules: agentInfo.context };

      let rules = '';
      let skills = '';

      // 1. Load rules
      try {
        rules = await ipcBridge.fs.readAssistantRule.invoke({
          assistantId: customAgentId,
          locale: localeKey,
        });
      } catch (error) {
        console.warn(`Failed to load rules for ${customAgentId}:`, error);
      }

      // 2. Load skills
      try {
        skills = await ipcBridge.fs.readAssistantSkill.invoke({
          assistantId: customAgentId,
          locale: localeKey,
        });
      } catch (error) {
        // skills may not exist, this is normal
      }

      // 3. Fallback: If builtin assistant and files are empty, load from builtin resources
      if (customAgentId.startsWith('builtin-')) {
        const presetId = customAgentId.replace('builtin-', '');
        const preset = ASSISTANT_PRESETS.find((p) => p.id === presetId);
        if (preset) {
          // Fallback for rules
          if (!rules && preset.ruleFiles) {
            try {
              const ruleFile = preset.ruleFiles[localeKey] || preset.ruleFiles['en-US'];
              if (ruleFile) {
                rules = await ipcBridge.fs.readBuiltinRule.invoke({ fileName: ruleFile });
              }
            } catch (e) {
              console.warn(`Failed to load builtin rules for ${customAgentId}:`, e);
            }
          }
          // Fallback for skills
          if (!skills && preset.skillFiles) {
            try {
              const skillFile = preset.skillFiles[localeKey] || preset.skillFiles['en-US'];
              if (skillFile) {
                skills = await ipcBridge.fs.readBuiltinSkill.invoke({ fileName: skillFile });
              }
            } catch (e) {
              // skills fallback failure is ok
            }
          }
        }
      }

      return { rules: rules || agentInfo.context, skills };
    },
    [localeKey]
  );

  // Backward compatible resolvePresetContext (returns only rules)
  const resolvePresetContext = useCallback(
    async (agentInfo: { backend: AcpBackend; customAgentId?: string; context?: string } | undefined): Promise<string | undefined> => {
      const { rules } = await resolvePresetRulesAndSkills(agentInfo);
      return rules;
    },
    [resolvePresetRulesAndSkills]
  );

  const resolvePresetAgentType = useCallback(
    (agentInfo: { backend: AcpBackend; customAgentId?: string } | undefined) => {
      if (!agentInfo) return 'gemini';
      if (agentInfo.backend !== 'custom') return 'gemini';
      const customAgent = customAgents.find((agent) => agent.id === agentInfo.customAgentId);
      return customAgent?.presetAgentType || 'gemini';
    },
    [customAgents]
  );

  // Resolve enabled skills for the assistant
  const resolveEnabledSkills = useCallback(
    (agentInfo: { backend: AcpBackend; customAgentId?: string } | undefined): string[] | undefined => {
      if (!agentInfo) return undefined;
      if (agentInfo.backend !== 'custom') return undefined;
      const customAgent = customAgents.find((agent) => agent.id === agentInfo.customAgentId);
      return customAgent?.enabledSkills;
    },
    [customAgents]
  );

  const refreshCustomAgents = useCallback(async () => {
    try {
      await ipcBridge.acpConversation.refreshCustomAgents.invoke();
      await mutate('acp.agents.available');
    } catch (error) {
      console.error('Failed to refresh custom agents:', error);
    }
  }, []);

  useEffect(() => {
    void refreshCustomAgents();
  }, [refreshCustomAgents]);

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      const match = value.match(mentionMatchRegex);
      if (match) {
        setMentionQuery(match[1]);
        setMentionOpen(true);
        setMentionSelectorOpen(false);
      } else {
        setMentionQuery(null);
        setMentionOpen(false);
      }
    },
    [mentionMatchRegex]
  );

  const handleSend = async () => {
    // User explicitly selected directory -> customWorkspace = true, use user selected directory
    // Not selected -> customWorkspace = false, pass empty to let backend create temp directory (gemini-temp-xxx)
    const isCustomWorkspace = !!dir;
    const finalWorkspace = dir || ''; // Pass empty when not specified, let backend create temp directory

    const agentInfo = selectedAgentInfo;
    const isPreset = isPresetAgent;
    const presetAgentType = resolvePresetAgentType(agentInfo);

    // Load rules (skills migrated to SkillManager)
    const { rules: presetRules } = await resolvePresetRulesAndSkills(agentInfo);
    // Get enabled skills list
    const enabledSkills = resolveEnabledSkills(agentInfo);

    // Image — dedicated image generation flow
    if (selectedAgentKey === 'image') {
      try {
        const conversation = await ipcBridge.conversation.create.invoke({
          type: 'image',
          name: input.substring(0, 60) || 'Image Generation',
          model: currentModel!, // not used by image but required by type
          extra: {},
        });

        if (!conversation?.id) {
          alert('Failed to create Image conversation.');
          return;
        }

        // Store initial prompt so ImageChat picks it up
        sessionStorage.setItem(`image_initial_message_${conversation.id}`, JSON.stringify({ input }));

        emitter.emit('chat.history.refresh');
        void navigate(`/conversation/${conversation.id}`);
      } catch (error: unknown) {
        console.error('Failed to create Image conversation:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        alert(`Failed to create Image conversation: ${errorMessage}`);
        throw error;
      }
      return;
    }

    // Ember — lightweight personal assistant
    if (selectedAgentKey === 'ember') {
      try {
        const conversation = await ipcBridge.conversation.create.invoke({
          type: 'ember',
          name: 'Ember',
          model: currentModel!, // not used by Ember but required by type
          extra: {},
        });

        if (!conversation?.id) {
          alert('Failed to create Ember conversation.');
          return;
        }

        emitter.emit('chat.history.refresh');
        void navigate(`/conversation/${conversation.id}`);
      } catch (error: unknown) {
        console.error('Failed to create Ember conversation:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        alert(`Failed to create Ember conversation: ${errorMessage}`);
        throw error;
      }
      return;
    }

    // Default to Gemini, or Preset configured as Gemini
    if (!selectedAgent || selectedAgent === 'gemini' || (isPreset && presetAgentType === 'gemini')) {
      if (!currentModel) return;
      try {
        const presetAssistantIdToPass = isPreset ? agentInfo?.customAgentId : undefined;

        const conversation = await ipcBridge.conversation.create.invoke({
          type: 'gemini',
          name: t('conversation.welcome.newConversation'), // Use default title, AI will generate smart title later
          model: currentModel,
          extra: {
            defaultFiles: files,
            workspace: finalWorkspace,
            customWorkspace: isCustomWorkspace,
            webSearchEngine: isGoogleAuth ? 'google' : 'default',
            // Pass rules (skills loaded via SkillManager)
            presetRules: isPreset ? presetRules : undefined,
            // Enabled skills list
            enabledSkills: isPreset ? enabledSkills : undefined,
            // Preset assistant ID for displaying name and avatar in conversation panel
            presetAssistantId: presetAssistantIdToPass,
          },
        });

        if (!conversation || !conversation.id) {
          throw new Error('Failed to create conversation - conversation object is null or missing id');
        }

        // Update workspace timestamp to ensure grouped sessions sort correctly (custom workspace only)
        if (isCustomWorkspace) {
          closeAllTabs();
          updateWorkspaceTime(finalWorkspace);
          // Add new conversation to tabs
          openTab(conversation);
        }

        // Trigger refresh immediately to let sidebar start loading new conversation (before navigation)
        emitter.emit('chat.history.refresh');

        // Store initial message to sessionStorage for GeminiSendBox to send after navigation
        // This enables instant page transition without waiting for API response
        const workspacePath = conversation.extra?.workspace || '';
        const displayMessage = buildDisplayMessage(input, files, workspacePath);
        const initialMessage = {
          input: displayMessage,
          files: files.length > 0 ? files : undefined,
        };
        sessionStorage.setItem(`gemini_initial_message_${conversation.id}`, JSON.stringify(initialMessage));

        // Navigate immediately for instant page transition
        void navigate(`/conversation/${conversation.id}`);
      } catch (error: unknown) {
        console.error('Failed to create or send Gemini message:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        alert(`Failed to create Gemini conversation: ${errorMessage}`);
        throw error; // Re-throw to prevent input clearing
      }
      return;
    } else if (selectedAgent === 'codex' || (isPreset && presetAgentType === 'codex')) {
      // Codex conversation type (including preset with codex agent type)
      const codexAgentInfo = agentInfo || findAgentByKey(selectedAgentKey);

      // Create Codex conversation and save initial message, conversation page handles sending
      try {
        const conversation = await ipcBridge.conversation.create.invoke({
          type: 'codex',
          name: t('conversation.welcome.newConversation'), // Use default title, AI will generate smart title later
          model: currentModel!, // not used by codex, but required by type
          extra: {
            defaultFiles: files,
            workspace: finalWorkspace,
            customWorkspace: isCustomWorkspace,
            // Pass preset context (rules only)
            presetContext: isPreset ? presetRules : undefined,
            // Enabled skills list (loaded via SkillManager)
            enabledSkills: isPreset ? enabledSkills : undefined,
            // Preset assistant ID for displaying name and avatar in conversation panel
            presetAssistantId: isPreset ? codexAgentInfo?.customAgentId : undefined,
          },
        });

        if (!conversation || !conversation.id) {
          alert('Failed to create Codex conversation. Please ensure the Codex CLI is installed and accessible in PATH.');
          return;
        }

        // Update workspace timestamp to ensure grouped sessions sort correctly (custom workspace only)
        if (isCustomWorkspace) {
          closeAllTabs();
          updateWorkspaceTime(finalWorkspace);
          // Add new conversation to tabs
          openTab(conversation);
        }

        // Trigger refresh immediately to let sidebar start loading new conversation (before navigation)
        emitter.emit('chat.history.refresh');

        // Let conversation page handle sending to avoid event loss
        const initialMessage = {
          input,
          files: files.length > 0 ? files : undefined,
        };
        sessionStorage.setItem(`codex_initial_message_${conversation.id}`, JSON.stringify(initialMessage));

        // Then navigate to conversation page
        await navigate(`/conversation/${conversation.id}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        alert(`Failed to create Codex conversation: ${errorMessage}`);
        throw error;
      }
      return;
    } else {
      // ACP conversation type (including preset with claude agent type)
      const acpAgentInfo = agentInfo || findAgentByKey(selectedAgentKey);

      // For preset with ACP-routed agent type (claude/opencode), use corresponding backend
      const acpBackend = isPreset && isAcpRoutedPresetType(presetAgentType) ? presetAgentType : selectedAgent;

      if (!acpAgentInfo && !isPreset) {
        alert(`${selectedAgent} CLI not found or not configured. Please ensure it's installed and accessible.`);
        return;
      }

      try {
        const conversation = await ipcBridge.conversation.create.invoke({
          type: 'acp',
          name: t('conversation.welcome.newConversation'), // Use default title, AI will generate smart title later
          model: currentModel!, // ACP needs a model too
          extra: {
            defaultFiles: files,
            workspace: finalWorkspace,
            customWorkspace: isCustomWorkspace,
            backend: acpBackend,
            cliPath: acpAgentInfo?.cliPath,
            agentName: acpAgentInfo?.name, // Store configured name for custom agents
            customAgentId: acpAgentInfo?.customAgentId, // UUID for custom agents
            // Pass preset context (rules only)
            presetContext: isPreset ? presetRules : undefined,
            // Enabled skills list (loaded via SkillManager)
            enabledSkills: isPreset ? enabledSkills : undefined,
            // Preset assistant ID for displaying name and avatar in conversation panel
            presetAssistantId: isPreset ? acpAgentInfo?.customAgentId : undefined,
          },
        });

        if (!conversation || !conversation.id) {
          alert('Failed to create ACP conversation. Please check your ACP configuration and ensure the CLI is installed.');
          return;
        }

        // Update workspace timestamp to ensure grouped sessions sort correctly (custom workspace only)
        if (isCustomWorkspace) {
          closeAllTabs();
          updateWorkspaceTime(finalWorkspace);
          // Add new conversation to tabs
          openTab(conversation);
        }

        // Trigger refresh immediately to let sidebar start loading new conversation (before navigation)
        emitter.emit('chat.history.refresh');

        // For ACP, we need to wait for the connection to be ready before sending the message
        // Store the initial message and let the conversation page handle it when ready
        const initialMessage = {
          input,
          files: files.length > 0 ? files : undefined,
        };

        // Store initial message in sessionStorage to be picked up by the conversation page
        sessionStorage.setItem(`acp_initial_message_${conversation.id}`, JSON.stringify(initialMessage));

        // Then navigate to conversation page
        await navigate(`/conversation/${conversation.id}`);
      } catch (error: unknown) {
        console.error('Failed to create ACP conversation:', error);

        // Check if it's an authentication error
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('[ACP-AUTH-')) {
          console.error(t('acp.auth.console_error'), errorMessage);
          const confirmed = window.confirm(t('acp.auth.failed_confirm', { backend: selectedAgent, error: errorMessage }));
          if (confirmed) {
            void navigate('/settings/model');
          }
        } else {
          alert(`Failed to create ${selectedAgent} ACP conversation. Please check your ACP configuration and ensure the CLI is installed.`);
        }
        throw error; // Re-throw to prevent input clearing
      }
    }
  };
  const sendMessageHandler = () => {
    setLoading(true);
    handleSend()
      .then(() => {
        // Clear all input states on successful send
        setInput('');
        setMentionOpen(false);
        setMentionQuery(null);
        setMentionSelectorOpen(false);
        setMentionActiveIndex(0);
        setFiles([]);
        setDir('');
      })
      .catch((error) => {
        console.error('Failed to send message:', error);
        // Keep the input content when there's an error
      })
      .finally(() => {
        setLoading(false);
      });
  };
  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (isComposing.current) return;
      // /command autocomplete takes priority when active
      if (slashAutocomplete.trigger === '/' && slashAutocomplete.handleKeyDown(event)) return;
      if ((mentionOpen || mentionSelectorOpen) && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        if (filteredMentionOptions.length === 0) return;
        setMentionActiveIndex((prev) => {
          if (event.key === 'ArrowDown') {
            return (prev + 1) % filteredMentionOptions.length;
          }
          return (prev - 1 + filteredMentionOptions.length) % filteredMentionOptions.length;
        });
        return;
      }
      if ((mentionOpen || mentionSelectorOpen) && event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (filteredMentionOptions.length > 0) {
          const query = mentionQuery?.toLowerCase();
          const exactMatch = query ? filteredMentionOptions.find((option) => option.label.toLowerCase() === query || option.tokens.has(query)) : undefined;
          const selected = exactMatch || filteredMentionOptions[mentionActiveIndex] || filteredMentionOptions[0];
          if (selected) {
            selectMentionAgent(selected.key);
            return;
          }
        }
        setMentionOpen(false);
        setMentionQuery(null);
        setMentionSelectorOpen(false);
        setMentionActiveIndex(0);
        return;
      }
      if (mentionOpen && (event.key === 'Backspace' || event.key === 'Delete') && !mentionQuery) {
        setMentionOpen(false);
        setMentionQuery(null);
        setMentionActiveIndex(0);
        return;
      }
      if (!mentionOpen && mentionSelectorVisible && !input.trim() && (event.key === 'Backspace' || event.key === 'Delete')) {
        event.preventDefault();
        setMentionSelectorVisible(false);
        setMentionSelectorOpen(false);
        setMentionActiveIndex(0);
        return;
      }
      if ((mentionOpen || mentionSelectorOpen) && event.key === 'Escape') {
        event.preventDefault();
        setMentionOpen(false);
        setMentionQuery(null);
        setMentionSelectorOpen(false);
        setMentionActiveIndex(0);
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (!input.trim()) return;
        sendMessageHandler();
      }
    },
    [filteredMentionOptions, mentionOpen, mentionQuery, mentionSelectorOpen, selectMentionAgent, sendMessageHandler, mentionActiveIndex, mentionSelectorVisible, input, isComposing, slashAutocomplete]
  );
  const setDefaultModel = async () => {
    if (!modelList || modelList.length === 0) {
      return;
    }
    const currentKey = selectedModelKeyRef.current || buildModelKey(currentModel?.id, currentModel?.useModel);
    // Keep current selection when still available
    if (isModelKeyAvailable(currentKey, modelList)) {
      if (!selectedModelKeyRef.current && currentKey) {
        selectedModelKeyRef.current = currentKey;
      }
      return;
    }
    // Read default config, or fallback to first model
    const savedModel = await ConfigStorage.get('gemini.defaultModel');

    // Handle backward compatibility: old format is string, new format is { id, useModel }
    const isNewFormat = savedModel && typeof savedModel === 'object' && 'id' in savedModel;

    let defaultModel: IProvider | undefined;
    let resolvedUseModel: string;

    if (isNewFormat) {
      // New format: find by provider ID first, then verify model exists
      const { id, useModel } = savedModel;
      const exactMatch = modelList.find((m) => m.id === id);
      if (exactMatch && exactMatch.model.includes(useModel)) {
        defaultModel = exactMatch;
        resolvedUseModel = useModel;
      } else {
        // Provider deleted or model removed, fallback
        defaultModel = modelList[0];
        resolvedUseModel = defaultModel?.model[0] ?? '';
      }
    } else if (typeof savedModel === 'string') {
      // Old format: fallback to model name matching (backward compatibility)
      defaultModel = modelList.find((m) => m.model.includes(savedModel)) || modelList[0];
      resolvedUseModel = defaultModel?.model.includes(savedModel) ? savedModel : (defaultModel?.model[0] ?? '');
    } else {
      // No saved model, use first one
      defaultModel = modelList[0];
      resolvedUseModel = defaultModel?.model[0] ?? '';
    }

    if (!defaultModel || !resolvedUseModel) return;

    await setCurrentModel({
      ...defaultModel,
      useModel: resolvedUseModel,
    });
  };
  useEffect(() => {
    setDefaultModel().catch((error) => {
      console.error('Failed to set default model:', error);
    });
  }, [modelList]);

  // Typewriter effect
  useEffect(() => {
    const fullText = t('conversation.welcome.placeholder');
    let currentIndex = 0;
    const typingSpeed = 80; // Typing speed per character (ms)
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const typeNextChar = () => {
      if (currentIndex <= fullText.length) {
        // Add cursor during typing
        setTypewriterPlaceholder(fullText.slice(0, currentIndex) + (currentIndex < fullText.length ? '|' : ''));
        currentIndex++;
      }
    };

    // Initial delay to let user see page loaded
    const initialDelay = setTimeout(() => {
      intervalId = setInterval(() => {
        typeNextChar();
        if (currentIndex > fullText.length) {
          if (intervalId) clearInterval(intervalId);
          setIsTyping(false); // Typing complete
          setTypewriterPlaceholder(fullText); // Remove cursor
        }
      }, typingSpeed);
    }, 300);

    // Cleanup: clear both timeout and interval
    return () => {
      clearTimeout(initialDelay);
      if (intervalId) clearInterval(intervalId);
    };
  }, [t]);
  return (
    <ConfigProvider getPopupContainer={() => guidContainerRef.current || document.body}>
      <div ref={guidContainerRef} className={styles.guidContainer}>
        <div className={styles.guidLayout}>
          <p className={`text-2xl font-semibold mb-8 text-0 text-center`}>{t('conversation.welcome.title')}</p>

          {/* Claude CLI installation prompt - shows when API configured but CLI not installed */}
          <div className='w-full max-w-600px mx-auto'>
            <ClaudeCliPrompt compact />
          </div>

          {/* Agent selector - below the title */}
          {availableAgents && availableAgents.length > 0 && (
            <div className='w-full flex justify-center'>
              <div
                className='inline-flex items-center bg-fill-2'
                style={{
                  marginBottom: 16,
                  padding: '4px',
                  borderRadius: '30px',
                  transition: 'all 0.6s cubic-bezier(0.2, 0.8, 0.3, 1)',
                  width: 'fit-content',
                  gap: 0,
                  color: 'var(--text-primary)',
                }}
              >
                {availableAgents
                  .filter((agent) => agent.backend !== 'custom')
                  .map((agent, index) => {
                    const isSelected = selectedAgentKey === getAgentKey(agent);
                    const logoSrc = AGENT_LOGO_MAP[agent.backend];

                    return (
                      <React.Fragment key={getAgentKey(agent)}>
                        {index > 0 && <div className='text-16px lh-1 p-2px select-none opacity-30'>|</div>}
                        <div
                          className={`group flex items-center cursor-pointer whitespace-nowrap overflow-hidden ${isSelected ? 'opacity-100 px-12px py-8px rd-20px mx-2px' : 'opacity-60 p-4px hover:opacity-100'}`}
                          style={
                            isSelected
                              ? {
                                  transition: 'opacity 0.5s cubic-bezier(0.2, 0.8, 0.3, 1)',
                                  backgroundColor: 'var(--fill-0)',
                                }
                              : { transition: 'opacity 0.5s cubic-bezier(0.2, 0.8, 0.3, 1)' }
                          }
                          onClick={() => {
                            setSelectedAgentKey(getAgentKey(agent));
                            setMentionOpen(false);
                            setMentionQuery(null);
                            setMentionSelectorOpen(false);
                            setMentionActiveIndex(0);
                          }}
                        >
                          {logoSrc ? <img src={logoSrc} alt={`${agent.backend} logo`} width={20} height={20} style={{ objectFit: 'contain', flexShrink: 0 }} /> : <Robot theme='outline' size={20} fill='currentColor' style={{ flexShrink: 0 }} />}
                          <span
                            className={`font-medium text-14px ${isSelected ? 'font-semibold ml-4px' : 'max-w-0 opacity-0 overflow-hidden group-hover:max-w-100px group-hover:opacity-100 group-hover:ml-8px'}`}
                            style={{
                              color: 'var(--text-primary)',
                              transition: isSelected ? 'color 0.5s cubic-bezier(0.2, 0.8, 0.3, 1), font-weight 0.5s cubic-bezier(0.2, 0.8, 0.3, 1)' : 'max-width 0.6s cubic-bezier(0.2, 0.8, 0.3, 1), opacity 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) 0.05s, margin 0.6s cubic-bezier(0.2, 0.8, 0.3, 1)',
                            }}
                          >
                            {agent.name}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                {/* Ember — built-in personal assistant */}
                {(() => {
                  const isSelected = selectedAgentKey === 'ember';
                  return (
                    <>
                      <div className='text-16px lh-1 p-2px select-none opacity-30'>|</div>
                      <div
                        className={`group flex items-center cursor-pointer whitespace-nowrap overflow-hidden ${isSelected ? 'opacity-100 px-12px py-8px rd-20px mx-2px' : 'opacity-60 p-4px hover:opacity-100'}`}
                        style={
                          isSelected
                            ? {
                                transition: 'opacity 0.5s cubic-bezier(0.2, 0.8, 0.3, 1)',
                                backgroundColor: 'var(--fill-0)',
                              }
                            : { transition: 'opacity 0.5s cubic-bezier(0.2, 0.8, 0.3, 1)' }
                        }
                        onClick={() => {
                          setSelectedAgentKey('ember');
                          setMentionOpen(false);
                          setMentionQuery(null);
                          setMentionSelectorOpen(false);
                          setMentionActiveIndex(0);
                        }}
                      >
                        <span style={{ fontSize: 18, lineHeight: '20px', flexShrink: 0 }}>&#x1F525;</span>
                        <span
                          className={`font-medium text-14px ${isSelected ? 'font-semibold ml-4px' : 'max-w-0 opacity-0 overflow-hidden group-hover:max-w-100px group-hover:opacity-100 group-hover:ml-8px'}`}
                          style={{
                            color: 'var(--text-primary)',
                            transition: isSelected ? 'color 0.5s cubic-bezier(0.2, 0.8, 0.3, 1), font-weight 0.5s cubic-bezier(0.2, 0.8, 0.3, 1)' : 'max-width 0.6s cubic-bezier(0.2, 0.8, 0.3, 1), opacity 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) 0.05s, margin 0.6s cubic-bezier(0.2, 0.8, 0.3, 1)',
                          }}
                        >
                          Ember
                        </span>
                      </div>
                    </>
                  );
                })()}
                {/* Image — dedicated image generation */}
                {(() => {
                  const isSelected = selectedAgentKey === 'image';
                  return (
                    <>
                      <div className='text-16px lh-1 p-2px select-none opacity-30'>|</div>
                      <div
                        className={`group flex items-center cursor-pointer whitespace-nowrap overflow-hidden ${isSelected ? 'opacity-100 px-12px py-8px rd-20px mx-2px' : 'opacity-60 p-4px hover:opacity-100'}`}
                        style={
                          isSelected
                            ? {
                                transition: 'opacity 0.5s cubic-bezier(0.2, 0.8, 0.3, 1)',
                                backgroundColor: 'var(--fill-0)',
                              }
                            : { transition: 'opacity 0.5s cubic-bezier(0.2, 0.8, 0.3, 1)' }
                        }
                        onClick={() => {
                          setSelectedAgentKey('image');
                          setMentionOpen(false);
                          setMentionQuery(null);
                          setMentionSelectorOpen(false);
                          setMentionActiveIndex(0);
                        }}
                      >
                        <span style={{ fontSize: 18, lineHeight: '20px', flexShrink: 0 }}>&#x1F3A8;</span>
                        <span
                          className={`font-medium text-14px ${isSelected ? 'font-semibold ml-4px' : 'max-w-0 opacity-0 overflow-hidden group-hover:max-w-100px group-hover:opacity-100 group-hover:ml-8px'}`}
                          style={{
                            color: 'var(--text-primary)',
                            transition: isSelected ? 'color 0.5s cubic-bezier(0.2, 0.8, 0.3, 1), font-weight 0.5s cubic-bezier(0.2, 0.8, 0.3, 1)' : 'max-width 0.6s cubic-bezier(0.2, 0.8, 0.3, 1), opacity 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) 0.05s, margin 0.6s cubic-bezier(0.2, 0.8, 0.3, 1)',
                          }}
                        >
                          Image
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          <div className='relative'>
            {slashAutocomplete.trigger === '/' && <SendBoxAutocomplete isOpen={slashAutocomplete.isOpen} trigger={slashAutocomplete.trigger} filteredOptions={slashAutocomplete.filteredOptions} activeIndex={slashAutocomplete.activeIndex} menuRef={slashAutocomplete.menuRef} onSelect={slashAutocomplete.handleSelect} />}
            <div
              className={`${styles.guidInputCard} relative p-16px border-3 b bg-dialog-fill-0 b-solid rd-20px flex flex-col ${mentionOpen ? 'overflow-visible' : 'overflow-hidden'} transition-all duration-200 ${isFileDragging ? 'border-dashed' : ''}`}
              style={{
                zIndex: 1,
                transition: 'box-shadow 0.25s ease, border-color 0.25s ease, border-width 0.25s ease',
                ...(isFileDragging
                  ? {
                      backgroundColor: 'var(--color-primary-light-1)',
                      borderColor: 'rgb(var(--primary-3))',
                      borderWidth: '1px',
                    }
                  : {
                      borderWidth: '1px',
                      borderColor: isInputActive ? activeBorderColor : inactiveBorderColor,
                      boxShadow: isInputActive ? activeShadow : 'none',
                    }),
              }}
              {...dragHandlers}
            >
              {mentionSelectorVisible && (
                <div className='flex items-center gap-8px mb-8px'>
                  <Dropdown
                    trigger='click'
                    popupVisible={mentionSelectorOpen}
                    onVisibleChange={(visible) => {
                      setMentionSelectorOpen(visible);
                      if (visible) {
                        setMentionQuery(null);
                      }
                    }}
                    droplist={mentionMenu}
                  >
                    <div className='flex items-center gap-6px bg-fill-2 px-10px py-4px rd-16px cursor-pointer select-none'>
                      <span className='text-14px font-medium text-t-primary'>@{selectedAgentLabel}</span>
                      <Down theme='outline' size={12} />
                    </div>
                  </Dropdown>
                </div>
              )}
              <Input.TextArea autoSize={{ minRows: 3, maxRows: 20 }} placeholder={typewriterPlaceholder || t('conversation.welcome.placeholder')} className={`text-16px focus:b-none rounded-xl !bg-transparent !b-none !resize-none !p-0 [&.arco-textarea-wrapper]:!b-none [&.arco-textarea-wrapper]:!shadow-none ${styles.lightPlaceholder}`} value={input} onChange={handleInputChange} onPaste={onPaste} onFocus={handleTextareaFocus} onBlur={handleTextareaBlur} {...compositionHandlers} onKeyDown={handleInputKeyDown}></Input.TextArea>
              {mentionOpen && (
                <div className='absolute z-50' style={{ left: 16, top: 44 }}>
                  {mentionMenu}
                </div>
              )}
              {files.length > 0 && (
                // Show pending files and allow cancellation
                <div className='flex flex-wrap items-center gap-8px mt-12px mb-12px'>
                  {files.map((path) => (
                    <FilePreview key={path} path={path} onRemove={() => handleRemoveFile(path)} />
                  ))}
                </div>
              )}
              <div className={styles.actionRow}>
                <div className={styles.actionTools}>
                  <Dropdown
                    trigger='hover'
                    onVisibleChange={setIsPlusDropdownOpen}
                    droplist={
                      <Menu
                        className='min-w-200px'
                        onClickMenuItem={(key) => {
                          if (key === 'file') {
                            ipcBridge.dialog.showOpen
                              .invoke({ properties: ['openFile', 'multiSelections'] })
                              .then((uploadedFiles) => {
                                if (uploadedFiles && uploadedFiles.length > 0) {
                                  // Files uploaded via dialog use append mode
                                  handleFilesUploaded(uploadedFiles);
                                }
                              })
                              .catch((error) => {
                                console.error('Failed to open file dialog:', error);
                              });
                          } else if (key === 'workspace') {
                            ipcBridge.dialog.showOpen
                              .invoke({ properties: ['openDirectory'] })
                              .then((files) => {
                                if (files && files[0]) {
                                  setDir(files[0]);
                                }
                              })
                              .catch((error) => {
                                console.error('Failed to open directory dialog:', error);
                              });
                          }
                        }}
                      >
                        <Menu.Item key='file'>
                          <div className='flex items-center gap-8px'>
                            <UploadOne theme='outline' size='16' fill={iconColors.secondary} style={{ lineHeight: 0 }} />
                            <span>{t('conversation.welcome.uploadFile')}</span>
                          </div>
                        </Menu.Item>
                        <Menu.Item key='workspace'>
                          <div className='flex items-center gap-8px'>
                            <FolderOpen theme='outline' size='16' fill={iconColors.secondary} style={{ lineHeight: 0 }} />
                            <span>{t('conversation.welcome.specifyWorkspace')}</span>
                          </div>
                        </Menu.Item>
                      </Menu>
                    }
                  >
                    <span className='flex items-center gap-4px cursor-pointer lh-[1]'>
                      <Button type='text' shape='circle' className={isPlusDropdownOpen ? styles.plusButtonRotate : ''} icon={<Plus theme='outline' size='14' strokeWidth={2} fill={iconColors.primary} />}></Button>
                      {files.length > 0 && (
                        <Tooltip className={'!max-w-max'} content={<span className='whitespace-break-spaces'>{getCleanFileNames(files).join('\n')}</span>}>
                          <span className='text-t-primary'>File({files.length})</span>
                        </Tooltip>
                      )}
                    </span>
                  </Dropdown>

                  {selectedAgentKey !== 'image' && selectedAgentKey !== 'ember' && (selectedAgent === 'gemini' || (isPresetAgent && resolvePresetAgentType(selectedAgentInfo) === 'gemini')) && (
                    <Dropdown
                      trigger='hover'
                      droplist={
                        <Menu selectedKeys={currentModel ? [currentModel.id + currentModel.useModel] : []}>
                          {!modelList || modelList.length === 0
                            ? [
                                /* No available models message */
                                <Menu.Item key='no-models' className='px-12px py-12px text-t-secondary text-14px text-center flex justify-center items-center' disabled>
                                  {t('settings.noAvailableModels')}
                                </Menu.Item>,
                                /* Add Model option */
                                <Menu.Item key='add-model' className='text-12px text-t-secondary' onClick={() => navigate('/settings/model')}>
                                  <Plus theme='outline' size='12' />
                                  {t('settings.addModel')}
                                </Menu.Item>,
                              ]
                            : [
                                ...(modelList || []).map((provider) => {
                                  const availableModels = getAvailableModels(provider);
                                  // Only render providers with available models
                                  if (availableModels.length === 0) return null;
                                  return (
                                    <Menu.ItemGroup title={provider.name} key={provider.id}>
                                      {availableModels.map((modelName) => {
                                        const isGoogleProvider = provider.platform?.toLowerCase().includes('gemini-with-google-auth');
                                        const option = isGoogleProvider ? geminiModeLookup.get(modelName) : undefined;

                                        // Manual mode: show submenu with specific models
                                        if (option?.subModels && option.subModels.length > 0) {
                                          return (
                                            <Menu.SubMenu
                                              key={provider.id + modelName}
                                              title={
                                                <div className='flex items-center justify-between gap-12px w-full'>
                                                  <span>{option.label}</span>
                                                </div>
                                              }
                                            >
                                              {option.subModels.map((subModel) => (
                                                <Menu.Item
                                                  key={provider.id + subModel.value}
                                                  className={currentModel?.id + currentModel?.useModel === provider.id + subModel.value ? '!bg-2' : ''}
                                                  onClick={() => {
                                                    setCurrentModel({ ...provider, useModel: subModel.value }).catch((error) => {
                                                      console.error('Failed to set current model:', error);
                                                    });
                                                  }}
                                                >
                                                  {subModel.label}
                                                </Menu.Item>
                                              ))}
                                            </Menu.SubMenu>
                                          );
                                        }

                                        // Normal mode: show single item
                                        return (
                                          <Menu.Item
                                            key={provider.id + modelName}
                                            className={currentModel?.id + currentModel?.useModel === provider.id + modelName ? '!bg-2' : ''}
                                            onClick={() => {
                                              setCurrentModel({ ...provider, useModel: modelName }).catch((error) => {
                                                console.error('Failed to set current model:', error);
                                              });
                                            }}
                                          >
                                            {(() => {
                                              if (!option) {
                                                return modelName;
                                              }
                                              return (
                                                <Tooltip
                                                  position='right'
                                                  trigger='hover'
                                                  content={
                                                    <div className='max-w-240px space-y-6px'>
                                                      <div className='text-12px text-t-secondary leading-5'>{option.description}</div>
                                                      {option.modelHint && <div className='text-11px text-t-tertiary'>{option.modelHint}</div>}
                                                    </div>
                                                  }
                                                >
                                                  <div className='flex items-center justify-between gap-12px w-full'>
                                                    <span>{option.label}</span>
                                                  </div>
                                                </Tooltip>
                                              );
                                            })()}
                                          </Menu.Item>
                                        );
                                      })}
                                    </Menu.ItemGroup>
                                  );
                                }),
                                /* Add Model option */
                                <Menu.Item key='add-model' className='text-12px text-t-secondary' onClick={() => navigate('/settings/model')}>
                                  <Plus theme='outline' size='12' />
                                  {t('settings.addModel')}
                                </Menu.Item>,
                              ]}
                        </Menu>
                      }
                    >
                      <Button className={'sendbox-model-btn'} shape='round'>
                        {currentModel ? formatGeminiModelLabel(currentModel, currentModel.useModel) : t('conversation.welcome.selectModel')}
                      </Button>
                    </Dropdown>
                  )}

                  {isPresetAgent && selectedAgentInfo && (
                    <div
                      className={styles.presetAgentTag}
                      onClick={() => {
                        /* Optional: Open assistant settings or do nothing, removal is via the X icon */
                      }}
                    >
                      {(() => {
                        const avatarValue = selectedAgentInfo.avatar?.trim();
                        const avatarImage = avatarValue ? CUSTOM_AVATAR_IMAGE_MAP[avatarValue] : undefined;
                        return avatarImage ? <img src={avatarImage} alt='' width={16} height={16} style={{ objectFit: 'contain', flexShrink: 0 }} /> : avatarValue ? <span style={{ fontSize: 14, lineHeight: '16px', flexShrink: 0 }}>{avatarValue}</span> : <Robot theme='outline' size={16} style={{ flexShrink: 0 }} />;
                      })()}
                      {(() => {
                        const agent = customAgents.find((a) => a.id === selectedAgentInfo.customAgentId);
                        const name = agent?.nameI18n?.[localeKey] || agent?.name || selectedAgentInfo.name;
                        return <span className={styles.presetAgentTagName}>{name}</span>;
                      })()}
                      <div
                        className={styles.presetAgentTagClose}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAgentKey('gemini'); // Reset to default
                        }}
                      >
                        <IconClose style={{ fontSize: 12, color: 'var(--color-text-3)' }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className={styles.actionSubmit}>
                  <Button
                    shape='circle'
                    type='primary'
                    loading={loading}
                    disabled={!input.trim() || (selectedAgentKey !== 'image' && selectedAgentKey !== 'ember' && (!selectedAgent || selectedAgent === 'gemini' || (isPresetAgent && resolvePresetAgentType(selectedAgentInfo) === 'gemini')) && !currentModel)}
                    icon={<ArrowUp theme='outline' size='14' fill='white' strokeWidth={2} />}
                    onClick={() => {
                      handleSend().catch((error) => {
                        console.error('Failed to send message:', error);
                      });
                    }}
                  />
                </div>
              </div>
              {dir && (
                <div className='flex items-center justify-between gap-6px h-28px mt-12px px-12px text-13px text-t-secondary ' style={{ borderTop: '1px solid var(--border-base)' }}>
                  <div className='flex items-center'>
                    <FolderOpen className='m-r-8px flex-shrink-0' theme='outline' size='16' fill={iconColors.secondary} style={{ lineHeight: 0 }} />
                    <Tooltip content={dir} position='top'>
                      <span className='truncate'>
                        {t('conversation.welcome.currentWorkspace')}: {dir.split(/[/\\]/).pop() || dir}
                      </span>
                    </Tooltip>
                  </div>
                  <Tooltip content={t('conversation.welcome.clearWorkspace')} position='top'>
                    <IconClose className='hover:text-[rgb(var(--danger-6))] hover:bg-3 transition-colors' strokeWidth={3} style={{ fontSize: 16 }} onClick={() => setDir('')} />
                  </Tooltip>
                </div>
              )}
            </div>
          </div>

          {/* Assistant Selection Area */}
          {customAgents && customAgents.some((a) => a.isPreset) && (
            <div className='mt-16px w-full'>
              {isPresetAgent && selectedAgentInfo ? (
                // Selected Assistant View
                <div className='flex flex-col w-full animate-fade-in'>
                  <div className='w-full'>
                    <div className='flex items-center justify-between py-8px cursor-pointer select-none' onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}>
                      <span className='text-13px text-[rgb(var(--primary-6))] opacity-80'>{t('settings.assistantDescription', { defaultValue: 'Assistant Description' })}</span>
                      <Down theme='outline' size={14} fill='rgb(var(--primary-6))' className={`transition-transform duration-300 ${isDescriptionExpanded ? 'rotate-180' : ''}`} />
                    </div>
                    <div className={`overflow-hidden transition-all duration-300 ${isDescriptionExpanded ? 'max-h-500px mt-4px opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div
                        className='p-12px rd-14px text-13px text-3 text-t-secondary whitespace-pre-wrap leading-relaxed '
                        style={{
                          border: '1px solid var(--color-border-2)',
                          background: 'var(--color-fill-1)',
                        }}
                      >
                        {customAgents.find((a) => a.id === selectedAgentInfo.customAgentId)?.descriptionI18n?.[localeKey] || customAgents.find((a) => a.id === selectedAgentInfo.customAgentId)?.description || t('settings.assistantDescriptionPlaceholder', { defaultValue: 'No description' })}
                      </div>
                    </div>
                  </div>

                  {/* Prompts Section */}
                  {(() => {
                    const agent = customAgents.find((a) => a.id === selectedAgentInfo.customAgentId);
                    const prompts = agent?.promptsI18n?.[localeKey] || agent?.promptsI18n?.['en-US'] || agent?.prompts;
                    if (prompts && prompts.length > 0) {
                      return (
                        <div className='flex flex-wrap gap-8px mt-16px'>
                          {prompts.map((prompt: string, index: number) => (
                            <div
                              key={index}
                              className='px-12px py-6px bg-fill-2 hover:bg-fill-3 text-[rgb(var(--primary-6))] text-13px rd-16px cursor-pointer transition-colors shadow-sm'
                              onClick={() => {
                                setInput(prompt);
                                handleTextareaFocus();
                              }}
                            >
                              {prompt}
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              ) : (
                // Assistant List View
                <div className='flex flex-wrap gap-8px justify-center'>
                  {customAgents
                    .filter((a) => a.isPreset && a.enabled !== false)
                    .sort((a, b) => {
                      if (a.id === 'cowork') return -1;
                      if (b.id === 'cowork') return 1;
                      return 0;
                    })
                    .map((assistant) => {
                      const avatarValue = assistant.avatar?.trim();
                      const avatarImage = avatarValue ? CUSTOM_AVATAR_IMAGE_MAP[avatarValue] : undefined;
                      return (
                        <div
                          key={assistant.id}
                          className='h-28px group flex items-center gap-8px px-16px rd-100px cursor-pointer transition-all b-1 b-solid border-arco-2 hover:bg-fill-0 select-none'
                          onClick={() => {
                            setSelectedAgentKey(`custom:${assistant.id}`);
                            setMentionOpen(false);
                            setMentionQuery(null);
                            setMentionSelectorOpen(false);
                            setMentionActiveIndex(0);
                          }}
                        >
                          {avatarImage ? <img src={avatarImage} alt='' width={16} height={16} style={{ objectFit: 'contain' }} /> : avatarValue ? <span style={{ fontSize: 16, lineHeight: '18px' }}>{avatarValue}</span> : <Robot theme='outline' size={16} />}
                          <span className='text-14px text-4 hover:text-2'>{assistant.nameI18n?.[localeKey] || assistant.name}</span>
                        </div>
                      );
                    })}
                  <div className='h-28px flex items-center gap-8px px-16px rd-100px cursor-pointer transition-all text-t-secondary hover:text-t-primary hover:bg-fill-2 b-1 b-dashed b-aou-2 select-none' onClick={() => navigate('/settings/agent')}>
                    <Plus theme='outline' size={14} className='line-height-0' />
                    <span className='text-13px'>{t('settings.createAssistant', { defaultValue: 'Create' })}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Recent Projects — collapsible, below chat input */}
          {projects.length > 0 && !dir && (
            <div className='w-full max-w-700px mx-auto mt-16px'>
              <div className='flex items-center gap-6px px-4px py-4px cursor-pointer select-none' onClick={() => setProjectsCollapsed(!projectsCollapsed)}>
                <Down theme='outline' size={12} fill='var(--text-tertiary)' className={`transition-transform duration-200 ${projectsCollapsed ? '-rotate-90' : ''}`} />
                <span className='text-13px font-500' style={{ color: 'var(--text-tertiary)' }}>
                  Projects
                </span>
              </div>
              {!projectsCollapsed && (
                <div className='grid gap-10px mt-4px' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                  {projects.slice(0, 6).map((p: IProjectInfo) => (
                    <ProjectCard
                      key={p.workspace}
                      project={p}
                      onClick={() => setDir(p.workspace)}
                      onArchive={() => {
                        void ipcBridge.project.archive.invoke({ workspace: p.workspace }).then(() => {
                          void mutate('projects-list');
                        });
                      }}
                      onDelete={() => {
                        void ipcBridge.project.remove.invoke({ workspace: p.workspace }).then(() => {
                          void mutate('projects-list');
                        });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Disclaimer at the bottom */}
        <p className='absolute bottom-24px left-50% -translate-x-1/2 text-center text-12px text-t-tertiary select-none'>{t('messages.aiDisclaimer')}</p>
      </div>
    </ConfigProvider>
  );
};

export default Guid;
