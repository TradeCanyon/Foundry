/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SignalAdapter — Message format converters for Signal.
 *
 * Converts between Signal CLI REST API format and Foundry's unified message types.
 * Uses signal-cli-rest-api: https://github.com/bbernhard/signal-cli-rest-api
 *
 * Signal doesn't have a public bot API. We connect via signal-cli-rest-api,
 * which wraps signal-cli in a REST+WebSocket interface.
 */

import type { IUnifiedIncomingMessage, IUnifiedUser, IUnifiedMessageContent, IUnifiedOutgoingMessage } from '../../types';

/**
 * Convert a Signal message (from signal-cli-rest-api) to unified format.
 */
export function toUnifiedIncomingMessage(envelope: any, ownNumber?: string): IUnifiedIncomingMessage | null {
  if (!envelope?.dataMessage) return null;
  const data = envelope.dataMessage;
  const source = envelope.source || envelope.sourceNumber;
  if (!source) return null;
  // Don't process our own messages
  if (ownNumber && source === ownNumber) return null;

  const chatId = envelope.sourceNumber || envelope.source;
  // For group messages, use groupId as chatId
  const groupId = data.groupInfo?.groupId;

  return {
    id: `signal-${envelope.timestamp || Date.now()}`,
    platform: 'signal',
    chatId: groupId || chatId,
    user: toUnifiedUser(envelope),
    content: extractMessageContent(data),
    timestamp: envelope.timestamp || Date.now(),
    raw: envelope,
  };
}

export function toUnifiedUser(envelope: any): IUnifiedUser {
  const source = envelope.source || envelope.sourceNumber || 'unknown';
  const name = envelope.sourceName || envelope.sourceNumber || source;
  return {
    id: source,
    username: source,
    displayName: name,
  };
}

function extractMessageContent(data: any): IUnifiedMessageContent {
  const text = data.message || '';
  const attachments = (data.attachments || []).map((att: any) => ({
    type: att.contentType?.startsWith('image/') ? 'photo' : 'document',
    fileName: att.filename,
    mimeType: att.contentType,
  }));

  if (attachments.length > 0) {
    return { type: attachments[0].type, text, attachments };
  }

  return { type: 'text', text };
}

/**
 * Convert unified outgoing message to signal-cli-rest-api send payload.
 */
export function toSignalPayload(message: IUnifiedOutgoingMessage, recipient: string, ownNumber: string): any {
  const payload: any = {
    message: message.text || '',
    number: ownNumber,
    recipients: [recipient],
  };

  // Signal doesn't support rich formatting in the same way.
  // Buttons are sent as numbered text options.
  if (message.type === 'buttons' && message.buttons) {
    const buttonText = message.buttons
      .flat()
      .map((btn: any, i: number) => `${i + 1}. ${btn.text || btn.label}`)
      .join('\n');
    payload.message = `${message.text || ''}\n\n${buttonText}`;
  }

  return payload;
}
