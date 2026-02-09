/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SlackPlugin — Slack channel adapter for Foundry.
 *
 * Uses @slack/bolt for Slack Events API via Socket Mode.
 * Requires: npm install @slack/bolt
 *
 * Connection: WebSocket via Socket Mode (no public URL needed)
 * Auth: Bot token + App-level token
 * Message limit: 40000 chars per message
 *
 * Setup:
 * 1. Create a Slack App at api.slack.com/apps
 * 2. Enable Socket Mode (Settings → Socket Mode)
 * 3. Add bot scopes: chat:write, channels:history, groups:history, im:history, users:read
 * 4. Install to workspace
 * 5. Use Bot Token (xoxb-...) as credentials.token
 * 6. Use App Token (xapp-...) as credentials.appId
 */

import { BasePlugin } from '../BasePlugin';
import type { IChannelPluginConfig, IUnifiedOutgoingMessage, PluginType } from '../../types';
import { toUnifiedIncomingMessage, toSlackPayload, splitMessage, SLACK_MESSAGE_LIMIT } from './SlackAdapter';

export class SlackPlugin extends BasePlugin {
  readonly type: PluginType = 'slack';

  private app: any = null;
  private activeUsers = new Set<string>();
  private botUserId: string | null = null;
  private botInfo: { username?: string; displayName?: string } | null = null;

  protected async onInitialize(config: IChannelPluginConfig): Promise<void> {
    const botToken = config.credentials?.token;
    const appToken = config.credentials?.appId; // Reusing appId field for Slack app-level token
    if (!botToken) throw new Error('Slack bot token (xoxb-...) is required');
    if (!appToken) throw new Error('Slack app-level token (xapp-...) is required for Socket Mode');
  }

  protected async onStart(): Promise<void> {
    const botToken = this.config?.credentials?.token;
    const appToken = this.config?.credentials?.appId;
    if (!botToken || !appToken) throw new Error('Slack credentials missing');

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      let bolt: any;
      try {
        bolt = require('@slack/bolt');
      } catch {
        throw new Error('Slack adapter requires @slack/bolt. Install with: npm install @slack/bolt');
      }

      const { App } = bolt;

      this.app = new App({
        token: botToken,
        appToken: appToken,
        socketMode: true,
      });

      // Get bot info
      const authResult = await this.app.client.auth.test({ token: botToken });
      this.botUserId = authResult.user_id;
      this.botInfo = {
        username: authResult.user,
        displayName: authResult.user || 'Ember',
      };

      // Listen for messages
      this.app.message(async ({ message }: any) => {
        const unified = toUnifiedIncomingMessage(message, this.botUserId ?? undefined);
        if (unified) {
          this.activeUsers.add(unified.user.id);
          void this.emitMessage(unified).catch((err) => {
            console.error('[SlackPlugin] Message handling error:', err);
          });
        }
      });

      // Listen for button actions (Block Kit interactions)
      this.app.action(/^confirm:/, async ({ action, ack, body }: any) => {
        await ack();
        const parts = (action.action_id || '').split(':');
        if (parts.length >= 3 && this.confirmHandler) {
          const [, callId, value] = parts;
          const userId = body.user?.id || '';
          void this.confirmHandler(userId, 'slack', callId, value).catch((err: any) => {
            console.error('[SlackPlugin] Confirm handler error:', err);
          });
        }
      });

      await this.app.start();
      console.log(`[SlackPlugin] Connected as ${this.botInfo.username}`);
    } catch (error: any) {
      throw new Error(`Slack connection failed: ${error.message}`);
    }
  }

  protected async onStop(): Promise<void> {
    if (this.app) {
      await this.app.stop();
      this.app = null;
    }
    this.activeUsers.clear();
    this.botUserId = null;
    this.botInfo = null;
  }

  async sendMessage(chatId: string, message: IUnifiedOutgoingMessage): Promise<string> {
    if (!this.app) throw new Error('Slack not connected');

    const text = message.text || '';
    if (text.length > SLACK_MESSAGE_LIMIT) {
      const parts = splitMessage(text);
      let lastTs = '';
      for (const part of parts) {
        const result = await this.app.client.chat.postMessage({
          channel: chatId,
          text: part,
          thread_ts: message.replyToMessageId,
        });
        lastTs = result.ts;
      }
      return lastTs;
    }

    const payload = toSlackPayload(message);
    const result = await this.app.client.chat.postMessage({
      channel: chatId,
      ...payload,
    });
    return result.ts || `slack-${Date.now()}`;
  }

  async editMessage(chatId: string, messageId: string, message: IUnifiedOutgoingMessage): Promise<void> {
    if (!this.app) return;
    try {
      const payload = toSlackPayload(message);
      await this.app.client.chat.update({
        channel: chatId,
        ts: messageId,
        ...payload,
      });
    } catch (error) {
      console.warn('[SlackPlugin] Failed to edit message:', error);
    }
  }

  getActiveUserCount(): number {
    return this.activeUsers.size;
  }

  getBotInfo(): { username?: string; displayName?: string } | null {
    return this.botInfo;
  }

  static async testConnection(botToken: string): Promise<{ success: boolean; botUsername?: string; error?: string }> {
    try {
      const response = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      const data = await response.json();
      if (data.ok) {
        return { success: true, botUsername: data.user };
      }
      return { success: false, error: data.error || 'Authentication failed' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
