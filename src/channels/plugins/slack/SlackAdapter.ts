/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SlackAdapter — Message format converters for Slack.
 *
 * Converts between Slack event/API format and Foundry's unified message types.
 * SDK: @slack/bolt (install when activating)
 */

import type { IUnifiedIncomingMessage, IUnifiedUser, IUnifiedMessageContent, IUnifiedOutgoingMessage } from '../../types';

/**
 * Convert a Slack message event to unified format.
 */
export function toUnifiedIncomingMessage(event: any, botUserId?: string): IUnifiedIncomingMessage | null {
  if (!event?.text || !event?.channel) return null;
  // Ignore bot messages and our own messages
  if (event.bot_id || event.subtype === 'bot_message') return null;
  if (botUserId && event.user === botUserId) return null;

  return {
    id: event.ts || `slack-${Date.now()}`,
    platform: 'slack',
    chatId: event.channel,
    user: toUnifiedUser(event),
    content: extractMessageContent(event),
    timestamp: event.ts ? parseFloat(event.ts) * 1000 : Date.now(),
    replyToMessageId: event.thread_ts,
    raw: event,
  };
}

export function toUnifiedUser(event: any): IUnifiedUser {
  return {
    id: event.user || 'unknown',
    username: event.user,
    displayName: event.user_profile?.display_name || event.user_profile?.real_name || `Slack User ${event.user}`,
    avatarUrl: event.user_profile?.image_72,
  };
}

function extractMessageContent(event: any): IUnifiedMessageContent {
  const text = event.text || '';
  const files = event.files || [];

  if (files.length > 0) {
    const attachments = files.map((file: any) => ({
      type: file.mimetype?.startsWith('image/') ? 'photo' : 'document',
      url: file.url_private,
      fileName: file.name,
      mimeType: file.mimetype,
    }));
    return { type: attachments[0].type, text, attachments };
  }

  return { type: 'text', text };
}

/**
 * Convert unified outgoing message to Slack API payload.
 */
export function toSlackPayload(message: IUnifiedOutgoingMessage, threadTs?: string): any {
  const payload: any = {
    text: message.text || '',
  };

  if (threadTs) {
    payload.thread_ts = threadTs;
  }

  // Slack Block Kit for rich formatting
  if (message.type === 'buttons' && message.buttons) {
    payload.blocks = [
      { type: 'section', text: { type: 'mrkdwn', text: message.text || '' } },
      {
        type: 'actions',
        elements: message.buttons.flat().map((btn: any) => ({
          type: 'button',
          text: { type: 'plain_text', text: btn.text || btn.label },
          action_id: btn.callbackData || btn.action,
          value: btn.callbackData || btn.value || '',
        })),
      },
    ];
  }

  if (message.type === 'image' && message.imageUrl) {
    payload.blocks = [...(payload.blocks || []), { type: 'image', image_url: message.imageUrl, alt_text: message.text || 'Image' }];
  }

  return payload;
}

/** Slack message limit: 40000 chars */
export const SLACK_MESSAGE_LIMIT = 40000;

/**
 * Split messages for Slack delivery.
 */
export function splitMessage(text: string, limit = SLACK_MESSAGE_LIMIT): string[] {
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      parts.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf('\n', limit);
    if (splitIdx <= 0) splitIdx = limit;
    parts.push(remaining.substring(0, splitIdx));
    remaining = remaining.substring(splitIdx).replace(/^\n/, '');
  }
  return parts;
}
