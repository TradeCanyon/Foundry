/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * WhatsAppPlugin — WhatsApp channel adapter for Foundry.
 *
 * Uses @whiskeysockets/baileys for WhatsApp Web Multi-Device protocol.
 * Requires: npm install @whiskeysockets/baileys
 *
 * Connection: WebSocket (persistent connection to WhatsApp servers)
 * Auth: QR code scan or stored credentials
 * Message limit: 65536 chars per message
 */

import { BasePlugin } from '../BasePlugin';
import type { IChannelPluginConfig, IUnifiedOutgoingMessage, PluginType } from '../../types';
import { toUnifiedIncomingMessage, toWhatsAppSendContent, splitMessage } from './WhatsAppAdapter';
import * as path from 'path';
import { app } from 'electron';

export class WhatsAppPlugin extends BasePlugin {
  readonly type: PluginType = 'whatsapp';

  private sock: any = null;
  private activeUsers = new Set<string>();
  private botInfo: { username?: string; displayName?: string } | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  protected async onInitialize(config: IChannelPluginConfig): Promise<void> {
    // Baileys requires no token — it uses QR code pairing or stored auth state.
    // The credentials.token field stores the auth state JSON for reconnection.
    if (!config.credentials?.token) {
      console.log('[WhatsAppPlugin] No stored auth state. QR code pairing will be required on start.');
    }
  }

  protected async onStart(): Promise<void> {
    try {
      // Dynamic import to avoid build failure when baileys isn't installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      let baileys: any;
      try {
        baileys = require('@whiskeysockets/baileys');
      } catch {
        throw new Error('WhatsApp adapter requires @whiskeysockets/baileys. Install with: npm install @whiskeysockets/baileys');
      }

      const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys;

      // Auth state stored in app data directory — always resolve within app data to prevent path traversal
      const appData = app?.getPath?.('userData') ?? '.';
      const authDir = path.join(appData, 'whatsapp-auth');
      const { state, saveCreds } = await useMultiFileAuthState(authDir);

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // For initial pairing
      });

      // Save credentials on update
      this.sock.ev.on('creds.update', saveCreds);

      // Connection status
      this.sock.ev.on('connection.update', (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          console.log('[WhatsAppPlugin] QR code generated — scan with WhatsApp mobile app');
        }
        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
            console.log(`[WhatsAppPlugin] Connection closed, reconnecting in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => void this.onStart(), delay);
          } else if (!shouldReconnect) {
            console.log('[WhatsAppPlugin] Logged out. Please re-pair.');
            this.setStatus('error', 'Logged out from WhatsApp. Re-pair required.');
          } else {
            this.setStatus('error', 'Max reconnection attempts reached');
          }
        }
        if (connection === 'open') {
          console.log('[WhatsAppPlugin] Connected to WhatsApp');
          this.reconnectAttempts = 0;
          this.botInfo = { displayName: 'Ember via WhatsApp' };
        }
      });

      // Incoming messages
      this.sock.ev.on('messages.upsert', (upsert: any) => {
        if (upsert.type !== 'notify') return;
        for (const msg of upsert.messages || []) {
          const unified = toUnifiedIncomingMessage(msg);
          if (unified) {
            this.activeUsers.add(unified.user.id);
            void this.emitMessage(unified).catch((err) => {
              console.error('[WhatsAppPlugin] Message handling error:', err);
            });
          }
        }
      });
    } catch (error: any) {
      throw new Error(`WhatsApp connection failed: ${error.message}`);
    }
  }

  protected async onStop(): Promise<void> {
    if (this.sock) {
      this.sock.end(undefined);
      this.sock = null;
    }
    this.activeUsers.clear();
  }

  async sendMessage(chatId: string, message: IUnifiedOutgoingMessage): Promise<string> {
    if (!this.sock) throw new Error('WhatsApp not connected');

    const content = toWhatsAppSendContent(message);

    // Handle long messages
    if (content.text && content.text.length > 65536) {
      const parts = splitMessage(content.text);
      let lastMsgId = '';
      for (const part of parts) {
        const sent = await this.sock.sendMessage(chatId, { text: part });
        lastMsgId = sent?.key?.id || lastMsgId;
      }
      return lastMsgId;
    }

    const sent = await this.sock.sendMessage(chatId, content);
    return sent?.key?.id || `wa-${Date.now()}`;
  }

  async editMessage(_chatId: string, _messageId: string, _message: IUnifiedOutgoingMessage): Promise<void> {
    // WhatsApp doesn't support message editing in the same way.
    // For streaming updates, we send a new message instead.
    // The ActionExecutor handles this gracefully.
    console.log('[WhatsAppPlugin] Message editing not supported on WhatsApp, skipping');
  }

  getActiveUserCount(): number {
    return this.activeUsers.size;
  }

  getBotInfo(): { username?: string; displayName?: string } | null {
    return this.botInfo;
  }

  static async testConnection(authPath: string): Promise<{ success: boolean; botUsername?: string; error?: string }> {
    try {
      // WhatsApp doesn't have a simple token test — it requires QR pairing.
      // Check if auth state exists at the given path.
      const fs = await import('fs');
      if (fs.existsSync(authPath)) {
        return { success: true, botUsername: 'WhatsApp (stored auth)' };
      }
      return { success: false, error: 'No stored auth state. QR pairing required.' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
