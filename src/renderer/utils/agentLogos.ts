/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared agent logo mapping for sidebar, chats page, project detail, etc.
 * Extracted from guid/index.tsx to avoid duplication.
 */

import type { TChatConversation } from '@/common/storage';
import type { AcpBackend } from '@/types/acpTypes';

import ClaudeLogo from '@/renderer/assets/logos/claude.svg';
import GeminiLogo from '@/renderer/assets/logos/gemini.svg';
import QwenLogo from '@/renderer/assets/logos/qwen.svg';
import CodexLogo from '@/renderer/assets/logos/codex.svg';
import DroidLogo from '@/renderer/assets/logos/droid.svg';
import IflowLogo from '@/renderer/assets/logos/iflow.svg';
import GooseLogo from '@/renderer/assets/logos/goose.svg';
import AuggieLogo from '@/renderer/assets/logos/auggie.svg';
import KimiLogo from '@/renderer/assets/logos/kimi.svg';
import OpenCodeLogo from '@/renderer/assets/logos/opencode.svg';
import GitHubLogo from '@/renderer/assets/logos/github.svg';
import QoderLogo from '@/renderer/assets/logos/qoder.png';

export const AGENT_LOGO_MAP: Partial<Record<AcpBackend, string>> = {
  claude: ClaudeLogo,
  gemini: GeminiLogo,
  qwen: QwenLogo,
  codex: CodexLogo,
  droid: DroidLogo,
  iflow: IflowLogo,
  goose: GooseLogo,
  auggie: AuggieLogo,
  kimi: KimiLogo,
  opencode: OpenCodeLogo,
  copilot: GitHubLogo,
  qoder: QoderLogo,
};

/**
 * Get the agent logo URL for a conversation based on its type and backend.
 * Returns null for non-agent conversations (image, ember).
 */
export function getConversationAgentLogo(conv: TChatConversation): string | null {
  if (conv.type === 'gemini') return AGENT_LOGO_MAP['gemini'] || null;
  if (conv.type === 'codex') return AGENT_LOGO_MAP['codex'] || null;
  if (conv.type === 'acp') {
    const backend = (conv.extra as Record<string, unknown>)?.backend as AcpBackend | undefined;
    return (backend && AGENT_LOGO_MAP[backend]) || null;
  }
  return null;
}
