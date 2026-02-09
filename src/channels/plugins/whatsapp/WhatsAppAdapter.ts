/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * WhatsAppAdapter — Message format converters for WhatsApp.
 *
 * Converts between WhatsApp message format and Foundry's
 * unified IUnifiedIncomingMessage / IUnifiedOutgoingMessage.
 *
 * SDK: @whiskeysockets/baileys (install when activating)
 */

import type { IUnifiedIncomingMessage, IUnifiedUser, IUnifiedMessageContent, IUnifiedOutgoingMessage } from '../../types';

/**
 * Convert a WhatsApp message event to unified format.
 * @param msg Raw message from Baileys upsert event
 * @param platform Plugin type identifier
 */
export function toUnifiedIncomingMessage(msg: any): IUnifiedIncomingMessage | null {
  if (!msg?.key?.remoteJid || !msg?.message) return null;

  const chatId = msg.key.remoteJid;
  const isFromMe = msg.key.fromMe ?? false;
  if (isFromMe) return null; // Don't process our own messages

  return {
    id: msg.key.id || `wa-${Date.now()}`,
    platform: 'whatsapp',
    chatId,
    user: toUnifiedUser(msg),
    content: extractMessageContent(msg.message),
    timestamp: (msg.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000,
    raw: msg,
  };
}

export function toUnifiedUser(msg: any): IUnifiedUser {
  const jid = msg?.key?.remoteJid || '';
  const pushName = msg?.pushName || '';
  // WhatsApp JIDs: "number@s.whatsapp.net" for individual, "number-number@g.us" for groups
  const userId = jid.split('@')[0] || jid;

  return {
    id: userId,
    username: userId,
    displayName: pushName || `WhatsApp User ${userId}`,
  };
}

function extractMessageContent(message: any): IUnifiedMessageContent {
  // Text message
  if (message.conversation) {
    return { type: 'text', text: message.conversation };
  }
  if (message.extendedTextMessage?.text) {
    return { type: 'text', text: message.extendedTextMessage.text };
  }

  // Image
  if (message.imageMessage) {
    return {
      type: 'photo',
      text: message.imageMessage.caption || '',
      attachments: [{ type: 'photo', fileId: message.imageMessage.mediaKey || '', mimeType: message.imageMessage.mimetype || 'image/jpeg' }],
    };
  }

  // Document
  if (message.documentMessage) {
    return {
      type: 'document',
      text: message.documentMessage.fileName || 'document',
      attachments: [{ type: 'document', fileId: message.documentMessage.mediaKey || '', mimeType: message.documentMessage.mimetype || 'application/octet-stream', fileName: message.documentMessage.fileName }],
    };
  }

  // Audio/Voice
  if (message.audioMessage) {
    return {
      type: message.audioMessage.ptt ? 'voice' : 'audio',
      text: '',
      attachments: [{ type: 'audio', fileId: message.audioMessage.mediaKey || '', mimeType: message.audioMessage.mimetype || 'audio/ogg' }],
    };
  }

  // Fallback
  return { type: 'text', text: '[Unsupported message type]' };
}

/**
 * Convert a unified outgoing message to WhatsApp send parameters.
 */
export function toWhatsAppSendContent(message: IUnifiedOutgoingMessage): any {
  if (message.type === 'image' && message.imageUrl) {
    return { image: { url: message.imageUrl }, caption: message.text || '' };
  }
  if (message.type === 'file' && message.fileUrl) {
    return { document: { url: message.fileUrl }, fileName: message.fileName || 'file' };
  }
  // Default: text message
  return { text: message.text || '' };
}

/** WhatsApp has a 65536 char limit per text message */
export const WHATSAPP_MESSAGE_LIMIT = 65536;

/**
 * Split long messages for WhatsApp delivery.
 */
export function splitMessage(text: string, limit = WHATSAPP_MESSAGE_LIMIT): string[] {
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += limit) {
    parts.push(text.substring(i, i + limit));
  }
  return parts;
}
