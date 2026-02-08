/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */
import type { CodexAgentEventType } from './eventTypes';

// Tool category enum
export enum ToolCategory {
  EXECUTION = 'execution', // shell, bash, python, etc.
  FILE_OPS = 'file_ops', // read, write, edit, search files
  SEARCH = 'search', // various search methods
  ANALYSIS = 'analysis', // code analysis, chart generation
  COMMUNICATION = 'communication', // network requests, API calls
  CUSTOM = 'custom', // MCP tools and other custom tools
}

// Output format enum
export enum OutputFormat {
  TEXT = 'text',
  MARKDOWN = 'markdown',
  JSON = 'json',
  IMAGE = 'image',
  CHART = 'chart',
  DIAGRAM = 'diagram',
  TABLE = 'table',
}

// Renderer type enum
export enum RendererType {
  STANDARD = 'standard', // Standard text rendering
  MARKDOWN = 'markdown', // Markdown rendering
  CODE = 'code', // Code highlighting rendering
  CHART = 'chart', // Chart rendering
  IMAGE = 'image', // Image rendering
  INTERACTIVE = 'interactive', // Interactive rendering
  COMPOSITE = 'composite', // Composite rendering
}

// Tool availability configuration
export interface ToolAvailability {
  platforms: string[]; // ['darwin', 'linux', 'win32']
  requires?: string[]; // Required tools or services
  experimental?: boolean; // Whether experimental feature
}

// Tool capabilities configuration
export interface ToolCapabilities {
  supportsStreaming: boolean;
  supportsImages: boolean;
  supportsCharts: boolean;
  supportsMarkdown: boolean;
  supportsInteraction: boolean; // Whether requires user interaction
  outputFormats: OutputFormat[];
}

// Renderer configuration
export interface ToolRenderer {
  type: RendererType;
  config: Record<string, any>;
}

// Tool definition interface
export interface ToolDefinition {
  id: string;
  name: string;
  displayNameKey: string; // i18n key for display name
  category: ToolCategory;
  priority: number; // Priority, lower number = higher priority
  availability: ToolAvailability;
  capabilities: ToolCapabilities;
  renderer: ToolRenderer;
  icon?: string; // Tool icon
  descriptionKey: string; // i18n key for description
  schema?: any; // Tool schema
}

// MCP tool information
export interface McpToolInfo {
  name: string;
  serverName: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

// Event data type definitions (simplified using CodexEventMsg structure)
export type EventDataMap = {
  [CodexAgentEventType.EXEC_COMMAND_BEGIN]: Extract<import('./eventData').CodexEventMsg, { type: 'exec_command_begin' }>;
  [CodexAgentEventType.EXEC_COMMAND_OUTPUT_DELTA]: Extract<import('./eventData').CodexEventMsg, { type: 'exec_command_output_delta' }>;
  [CodexAgentEventType.EXEC_COMMAND_END]: Extract<import('./eventData').CodexEventMsg, { type: 'exec_command_end' }>;
  [CodexAgentEventType.APPLY_PATCH_APPROVAL_REQUEST]: Extract<import('./eventData').CodexEventMsg, { type: 'apply_patch_approval_request' }>;
  [CodexAgentEventType.PATCH_APPLY_BEGIN]: Extract<import('./eventData').CodexEventMsg, { type: 'patch_apply_begin' }>;
  [CodexAgentEventType.PATCH_APPLY_END]: Extract<import('./eventData').CodexEventMsg, { type: 'patch_apply_end' }>;
  [CodexAgentEventType.MCP_TOOL_CALL_BEGIN]: Extract<import('./eventData').CodexEventMsg, { type: 'mcp_tool_call_begin' }>;
  [CodexAgentEventType.MCP_TOOL_CALL_END]: Extract<import('./eventData').CodexEventMsg, { type: 'mcp_tool_call_end' }>;
  [CodexAgentEventType.WEB_SEARCH_BEGIN]: Extract<import('./eventData').CodexEventMsg, { type: 'web_search_begin' }>;
  [CodexAgentEventType.WEB_SEARCH_END]: Extract<import('./eventData').CodexEventMsg, { type: 'web_search_end' }>;
};
