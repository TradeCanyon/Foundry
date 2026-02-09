import type { BadgeProps } from '@arco-design/web-react';
import { Badge, Tooltip } from '@arco-design/web-react';
import { IconDown, IconRight } from '@arco-design/web-react/icon';
import React, { useMemo, useState } from 'react';
import type { IMessageAcpToolCall, IMessageToolGroup } from '../../common/chatLib';
import './MessageToolGroupSummary.css';

// Status icons for compact display
const STATUS_ICONS = {
  success: '\u2713', // ✓
  error: '\u2717', // ✗
  processing: '\u23F3', // ⏳
  default: '\u25CB', // ○
};

// Categorize tool names into operation types for compact display
const OPERATION_CATEGORIES: Record<string, string[]> = {
  Read: ['ReadFile', 'read_file', 'ReadMany', 'read_many_files', 'View', 'view_file'],
  Write: ['WriteFile', 'write_file', 'Create', 'create_file', 'Edit', 'edit_file'],
  Shell: ['Shell', 'shell', 'Exec', 'exec', 'RunCommand', 'run_command', 'bash'],
  Search: ['Search', 'search', 'Grep', 'grep', 'Find', 'find', 'glob'],
  Web: ['WebFetch', 'web_fetch', 'WebSearch', 'web_search'],
  Browser: ['BrowserNavigate', 'browser_navigate', 'BrowserClick', 'browser_click', 'BrowserFill', 'browser_fill', 'BrowserScreenshot', 'browser_screenshot', 'BrowserExtract', 'browser_extract', 'BrowserWait', 'browser_wait'],
  MCP: [], // MCP tools are handled separately
};

const getOperationCategory = (toolName: string): string => {
  for (const [category, names] of Object.entries(OPERATION_CATEGORIES)) {
    if (names.some((n) => toolName.toLowerCase().includes(n.toLowerCase()))) {
      return category;
    }
  }
  return 'Other';
};

interface ToolInfo {
  key: string;
  name: string;
  desc: string;
  status: BadgeProps['status'];
  category: string;
}

const ToolGroupMapper = (m: IMessageToolGroup): ToolInfo[] => {
  return m.content.map(({ name, callId, description, confirmationDetails, status }) => {
    let desc = description.slice(0, 100);
    const type = confirmationDetails?.type;
    if (type === 'edit') desc = confirmationDetails.fileName;
    if (type === 'exec') desc = confirmationDetails.command;
    if (type === 'info') desc = confirmationDetails.urls?.join(';') || confirmationDetails.title;
    if (type === 'mcp') desc = confirmationDetails.serverName + ':' + confirmationDetails.toolName;
    return {
      key: callId,
      name: name,
      desc,
      status: (status === 'Success' ? 'success' : status === 'Error' ? 'error' : status === 'Canceled' ? 'default' : 'processing') as BadgeProps['status'],
      category: type === 'mcp' ? 'MCP' : getOperationCategory(name),
    };
  });
};

const ToolAcpMapper = (message: IMessageAcpToolCall): ToolInfo | undefined => {
  const update = message.content.update;
  if (!update) return;
  const name = String(update.rawInput?.description || update.title || '');
  const desc = String(update.rawInput?.command || update.kind || '');
  return {
    key: update.toolCallId,
    name,
    desc,
    status: update.status === 'completed' ? 'success' : update.status === 'failed' ? 'error' : ('default' as BadgeProps['status']),
    category: getOperationCategory(name),
  };
};

interface CategorySummary {
  category: string;
  total: number;
  success: number;
  error: number;
  processing: number;
}

const MessageToolGroupSummary: React.FC<{ messages: Array<IMessageToolGroup | IMessageAcpToolCall> }> = ({ messages }) => {
  // Default to collapsed unless there are running operations
  const [showMore, setShowMore] = useState(() => {
    if (!messages.length) return false;
    return messages.some((m) => (m.type === 'tool_group' && m.content.some((t) => t.status !== 'Success' && t.status !== 'Error' && t.status !== 'Canceled')) || (m.type === 'acp_tool_call' && m.content.update.status !== 'completed'));
  });

  const tools = useMemo(() => {
    return messages
      .map((m) => {
        if (m.type === 'tool_group') return ToolGroupMapper(m);
        return ToolAcpMapper(m);
      })
      .flat()
      .filter((t): t is ToolInfo => t !== undefined);
  }, [messages]);

  // Calculate category summaries for compact display
  const categorySummaries = useMemo((): CategorySummary[] => {
    const summaryMap = new Map<string, CategorySummary>();

    for (const tool of tools) {
      const existing = summaryMap.get(tool.category);
      if (existing) {
        existing.total++;
        if (tool.status === 'success') existing.success++;
        else if (tool.status === 'error') existing.error++;
        else if (tool.status === 'processing') existing.processing++;
      } else {
        summaryMap.set(tool.category, {
          category: tool.category,
          total: 1,
          success: tool.status === 'success' ? 1 : 0,
          error: tool.status === 'error' ? 1 : 0,
          processing: tool.status === 'processing' ? 1 : 0,
        });
      }
    }

    return Array.from(summaryMap.values());
  }, [tools]);

  // Get overall status for the summary badge
  const overallStatus = useMemo((): BadgeProps['status'] => {
    const hasError = tools.some((t) => t.status === 'error');
    const hasProcessing = tools.some((t) => t.status === 'processing');
    if (hasError) return 'error';
    if (hasProcessing) return 'processing';
    return 'success';
  }, [tools]);

  // Render compact category badge
  const renderCategoryBadge = (summary: CategorySummary) => {
    const status = summary.error > 0 ? 'error' : summary.processing > 0 ? 'processing' : 'success';
    const icon = STATUS_ICONS[status];
    const isProcessing = summary.processing > 0;

    return (
      <Tooltip key={summary.category} content={`${summary.category}: ${summary.success} completed, ${summary.processing} running, ${summary.error} failed`}>
        <span className={`inline-flex items-center gap-2px px-6px py-2px rd-4px bg-fill-2 text-12px cursor-default ${isProcessing ? 'animate-pulse' : ''}`}>
          <span className={status === 'success' ? 'color-green-6' : status === 'error' ? 'color-red-6' : 'color-blue-6'}>{icon}</span>
          <span className='color-#86909C'>
            {summary.category} ({summary.total})
          </span>
        </span>
      </Tooltip>
    );
  };

  // Check if any operations are currently running
  const hasActiveOperations = tools.some((t) => t.status === 'processing');

  if (tools.length === 0) return null;

  // Activity indicator component - three pulsing dots like Claude
  const ActivityIndicator = () => (
    <div className='activity-indicator'>
      <span className='activity-dot' />
      <span className='activity-dot' />
      <span className='activity-dot' />
    </div>
  );

  return (
    <div className='tool-group-cloud'>
      {/* Compact one-line summary header */}
      <div className='flex items-center gap-8px flex-wrap'>
        <div className='flex items-center gap-6px color-#86909C cursor-pointer select-none' onClick={() => setShowMore(!showMore)}>
          <Badge status={overallStatus} className={overallStatus === 'processing' ? 'badge-breathing' : ''} />
          <span className='text-13px font-medium'>
            {hasActiveOperations ? (
              // Show progress: "3 of 5 operations"
              <>
                {tools.filter((t) => t.status === 'success').length} of {tools.length} operation{tools.length !== 1 ? 's' : ''}
              </>
            ) : (
              // Show total when complete
              <>
                {tools.length} operation{tools.length !== 1 ? 's' : ''}
              </>
            )}
          </span>
          {hasActiveOperations && <ActivityIndicator />}
          {showMore ? <IconDown className='text-12px ml-4px' /> : <IconRight className='text-12px ml-4px' />}
        </div>

        {/* Category badges - always visible for quick overview */}
        <div className='flex items-center gap-4px flex-wrap'>{categorySummaries.map(renderCategoryBadge)}</div>
      </div>

      {/* Progress bar when operations are running */}
      {hasActiveOperations && (
        <div className='tool-progress-bar'>
          <div
            className='tool-progress-bar-fill'
            style={{
              width: `${Math.round((tools.filter((t) => t.status === 'success').length / tools.length) * 100)}%`,
            }}
          />
        </div>
      )}

      {/* Expanded details */}
      {showMore && (
        <div className='flex flex-col gap-2px pt-10px'>
          {tools.map((item) => {
            const isActive = item.status === 'processing';
            return (
              <div key={item.key} className={`operation-item relative ${isActive ? 'is-active' : ''}`}>
                <Badge status={item.status} className={isActive ? 'badge-breathing' : ''} />
                <span className='font-medium text-12px color-#86909C min-w-60px'>{item.name}</span>
                <span className='truncate flex-1 text-12px color-#A0A0A0'>{item.desc}</span>
                {isActive && <ActivityIndicator />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default React.memo(MessageToolGroupSummary);
