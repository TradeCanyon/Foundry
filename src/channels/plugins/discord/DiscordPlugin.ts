/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * DiscordPlugin — Discord channel adapter for Foundry.
 *
 * Uses discord.js for Discord Gateway (WebSocket) connection.
 * Requires: npm install discord.js
 *
 * Connection: WebSocket via Discord Gateway
 * Auth: Bot token (from Discord Developer Portal)
 * Message limit: 2000 chars per message
 */

import { BasePlugin } from '../BasePlugin';
import type { IChannelPluginConfig, IUnifiedOutgoingMessage, PluginType } from '../../types';
import { toUnifiedIncomingMessage, toDiscordPayload, splitMessage, DISCORD_MESSAGE_LIMIT } from './DiscordAdapter';

export class DiscordPlugin extends BasePlugin {
  readonly type: PluginType = 'discord';

  private client: any = null;
  private activeUsers = new Set<string>();
  private botUser: { id?: string; username?: string; displayName?: string } | null = null;

  protected async onInitialize(config: IChannelPluginConfig): Promise<void> {
    const token = config.credentials?.token;
    if (!token) throw new Error('Discord bot token is required');
  }

  protected async onStart(): Promise<void> {
    const token = this.config?.credentials?.token;
    if (!token) throw new Error('Discord bot token is required');

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      let discordJs: any;
      try {
        discordJs = require('discord.js');
      } catch {
        throw new Error('Discord adapter requires discord.js. Install with: npm install discord.js');
      }

      const { Client, GatewayIntentBits } = discordJs;

      this.client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
      });

      // Ready event
      this.client.once('ready', () => {
        const user = this.client.user;
        this.botUser = {
          id: user?.id,
          username: user?.username,
          displayName: user?.globalName || user?.username || 'Ember',
        };
        console.log(`[DiscordPlugin] Connected as ${this.botUser.username}`);
      });

      // Message event
      this.client.on('messageCreate', (msg: any) => {
        const unified = toUnifiedIncomingMessage(msg, this.botUser?.id);
        if (unified) {
          this.activeUsers.add(unified.user.id);
          void this.emitMessage(unified).catch((err) => {
            console.error('[DiscordPlugin] Message handling error:', err);
          });
        }
      });

      // Interaction event (button presses)
      this.client.on('interactionCreate', async (interaction: any) => {
        if (!interaction.isButton?.()) return;
        const customId = interaction.customId || '';
        const parts = customId.split(':');
        if (parts.length >= 3 && this.confirmHandler) {
          const [action, callId, value] = parts;
          if (action === 'confirm') {
            await interaction.deferUpdate?.();
            void this.confirmHandler(interaction.user.id, 'discord', callId, value).catch((err: any) => {
              console.error('[DiscordPlugin] Confirm handler error:', err);
            });
          }
        }
      });

      await this.client.login(token);
    } catch (error: any) {
      throw new Error(`Discord connection failed: ${error.message}`);
    }
  }

  protected async onStop(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    this.activeUsers.clear();
    this.botUser = null;
  }

  async sendMessage(chatId: string, message: IUnifiedOutgoingMessage): Promise<string> {
    if (!this.client) throw new Error('Discord not connected');

    const channel = await this.client.channels.fetch(chatId);
    if (!channel?.send) throw new Error(`Cannot send to channel ${chatId}`);

    const text = message.text || '';
    if (text.length > DISCORD_MESSAGE_LIMIT) {
      const parts = splitMessage(text);
      let lastMsgId = '';
      for (const part of parts) {
        const sent = await channel.send({ content: part });
        lastMsgId = sent.id;
      }
      return lastMsgId;
    }

    const payload = toDiscordPayload(message);
    const sent = await channel.send(payload);
    return sent.id;
  }

  async editMessage(chatId: string, messageId: string, message: IUnifiedOutgoingMessage): Promise<void> {
    if (!this.client) return;
    try {
      const channel = await this.client.channels.fetch(chatId);
      const msg = await channel?.messages?.fetch(messageId);
      if (msg) {
        const payload = toDiscordPayload(message);
        await msg.edit(payload);
      }
    } catch (error) {
      console.warn('[DiscordPlugin] Failed to edit message:', error);
    }
  }

  getActiveUserCount(): number {
    return this.activeUsers.size;
  }

  getBotInfo(): { username?: string; displayName?: string } | null {
    return this.botUser;
  }

  static async testConnection(token: string): Promise<{ success: boolean; botUsername?: string; error?: string }> {
    try {
      // Use Discord REST API to validate token
      const response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${token}` },
      });
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: Invalid token` };
      }
      const data = await response.json();
      return { success: true, botUsername: data.username };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
