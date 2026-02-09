/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * DiscordAdapter — Message format converters for Discord.
 *
 * Converts between Discord message format and Foundry's unified message types.
 * SDK: discord.js (install when activating)
 */

import type { IUnifiedIncomingMessage, IUnifiedUser, IUnifiedMessageContent, IUnifiedOutgoingMessage } from '../../types';

/**
 * Convert a Discord message to unified format.
 */
export function toUnifiedIncomingMessage(msg: any, botId?: string): IUnifiedIncomingMessage | null {
  if (!msg?.id || !msg?.channel_id) return null;
  // Ignore bot messages (including our own)
  if (msg.author?.bot) return null;
  if (botId && msg.author?.id === botId) return null;

  return {
    id: msg.id,
    platform: 'discord',
    chatId: msg.channel_id,
    user: toUnifiedUser(msg.author),
    content: extractMessageContent(msg),
    timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
    raw: msg,
  };
}

export function toUnifiedUser(author: any): IUnifiedUser {
  if (!author) return { id: 'unknown', displayName: 'Unknown User' };
  return {
    id: author.id,
    username: author.username,
    displayName: author.global_name || author.username || `User ${author.id}`,
    avatarUrl: author.avatar ? `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png` : undefined,
  };
}

function extractMessageContent(msg: any): IUnifiedMessageContent {
  const text = msg.content || '';
  const attachments = (msg.attachments || []).map((att: any) => ({
    type: att.content_type?.startsWith('image/') ? 'photo' : 'document',
    url: att.url,
    fileName: att.filename,
    mimeType: att.content_type,
  }));

  if (attachments.length > 0) {
    const firstType = attachments[0].type;
    return { type: firstType, text, attachments };
  }

  return { type: 'text', text };
}

/**
 * Convert unified outgoing message to Discord API payload.
 */
export function toDiscordPayload(message: IUnifiedOutgoingMessage): any {
  const payload: any = {};

  if (message.text) {
    payload.content = message.text;
  }

  if (message.type === 'image' && message.imageUrl) {
    payload.embeds = [{ image: { url: message.imageUrl } }];
  }

  if (message.replyToMessageId) {
    payload.message_reference = { message_id: message.replyToMessageId };
  }

  return payload;
}

/** Discord message limit: 2000 chars */
export const DISCORD_MESSAGE_LIMIT = 2000;

/**
 * Split messages for Discord delivery.
 */
export function splitMessage(text: string, limit = DISCORD_MESSAGE_LIMIT): string[] {
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  // Try to split at newlines for cleaner output
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
