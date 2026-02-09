/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SignalPlugin — Signal channel adapter for Foundry.
 *
 * Connects to Signal via signal-cli-rest-api, which provides:
 * - REST API for sending messages
 * - WebSocket for receiving messages in real-time
 *
 * Setup:
 * 1. Run signal-cli-rest-api: docker run -p 8080:8080 bbernhard/signal-cli-rest-api
 * 2. Register/link a phone number via the REST API
 * 3. Set credentials.token = phone number (e.g., "+1234567890")
 * 4. Set credentials.appId = REST API base URL (e.g., "http://localhost:8080")
 *
 * Connection: WebSocket to signal-cli-rest-api
 * Auth: Registered phone number + signal-cli-rest-api URL
 * No message size limit (Signal supports up to ~20KB per message)
 */

import { BasePlugin } from '../BasePlugin';
import type { IChannelPluginConfig, IUnifiedOutgoingMessage, PluginType } from '../../types';
import { toUnifiedIncomingMessage, toSignalPayload } from './SignalAdapter';

export class SignalPlugin extends BasePlugin {
  readonly type: PluginType = 'signal';

  private ws: WebSocket | null = null;
  private apiBaseUrl: string = '';
  private phoneNumber: string = '';
  private activeUsers = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;

  /** Validate that a URL is safe (no SSRF to internal/metadata endpoints). */
  private static validateApiUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Invalid signal-cli-rest-api URL: ${url}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('signal-cli-rest-api URL must use http:// or https://');
    }
    // Block cloud metadata and link-local endpoints
    const blockedHosts = ['169.254.169.254', 'metadata.google.internal', '100.100.100.200'];
    if (blockedHosts.includes(parsed.hostname)) {
      throw new Error('signal-cli-rest-api URL points to a blocked internal address');
    }
  }

  protected async onInitialize(config: IChannelPluginConfig): Promise<void> {
    const phoneNumber = config.credentials?.token;
    const apiBaseUrl = config.credentials?.appId;
    if (!phoneNumber) throw new Error('Signal phone number is required (e.g., +1234567890)');
    if (!apiBaseUrl) throw new Error('signal-cli-rest-api URL is required (e.g., http://localhost:8080)');
    SignalPlugin.validateApiUrl(apiBaseUrl);
    this.phoneNumber = phoneNumber;
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
  }

  protected async onStart(): Promise<void> {
    // Verify the REST API is accessible
    try {
      const response = await fetch(`${this.apiBaseUrl}/v1/about`);
      if (!response.ok) {
        throw new Error(`signal-cli-rest-api not accessible at ${this.apiBaseUrl}`);
      }
    } catch (error: any) {
      throw new Error(`Cannot reach signal-cli-rest-api at ${this.apiBaseUrl}: ${error.message}`);
    }

    // Connect WebSocket for incoming messages
    this.connectWebSocket();
  }

  private connectWebSocket(): void {
    const wsUrl = this.apiBaseUrl.replace(/^http/, 'ws') + `/v1/receive/${encodeURIComponent(this.phoneNumber)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`[SignalPlugin] WebSocket connected for ${this.phoneNumber}`);
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          const envelope = data.envelope || data;
          const unified = toUnifiedIncomingMessage(envelope, this.phoneNumber);
          if (unified) {
            this.activeUsers.add(unified.user.id);
            void this.emitMessage(unified).catch((err) => {
              console.error('[SignalPlugin] Message handling error:', err);
            });
          }
        } catch (error) {
          console.warn('[SignalPlugin] Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        if (this._status === 'running') {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error: Event) => {
        console.error('[SignalPlugin] WebSocket error:', error);
      };
    } catch (error: any) {
      console.error('[SignalPlugin] WebSocket connection failed:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('error', 'Max reconnection attempts reached');
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`[SignalPlugin] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      if (this._status === 'running') {
        this.connectWebSocket();
      }
    }, delay);
  }

  protected async onStop(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.activeUsers.clear();
  }

  async sendMessage(chatId: string, message: IUnifiedOutgoingMessage): Promise<string> {
    const payload = toSignalPayload(message, chatId, this.phoneNumber);

    const response = await fetch(`${this.apiBaseUrl}/v2/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Signal send failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return result.timestamp?.toString() || `signal-${Date.now()}`;
  }

  async editMessage(_chatId: string, _messageId: string, _message: IUnifiedOutgoingMessage): Promise<void> {
    // Signal doesn't support message editing.
    // For streaming updates, ActionExecutor will handle by sending new messages.
    console.log('[SignalPlugin] Message editing not supported on Signal, skipping');
  }

  getActiveUserCount(): number {
    return this.activeUsers.size;
  }

  getBotInfo(): { username?: string; displayName?: string } | null {
    return { username: this.phoneNumber, displayName: `Ember (${this.phoneNumber})` };
  }

  static async testConnection(apiBaseUrl: string): Promise<{ success: boolean; botUsername?: string; error?: string }> {
    try {
      const url = apiBaseUrl.replace(/\/$/, '');
      const response = await fetch(`${url}/v1/about`);
      if (!response.ok) {
        return { success: false, error: `API returned ${response.status}` };
      }
      const data = await response.json();
      return { success: true, botUsername: `signal-cli ${data.version || 'connected'}` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
