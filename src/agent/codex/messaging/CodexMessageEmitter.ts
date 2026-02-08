/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IResponseMessage } from '@/common/ipcBridge';
import type { TMessage, IConfirmation } from '@/common/chatLib';

/**
 * Message emission callback interface
 * Used to decouple handlers from direct message dispatch and persistence dependencies
 */
export interface ICodexMessageEmitter {
  /**
   * Send message to frontend and persist as needed
   * @param message Message to send (IResponseMessage format)
   * @param persist Whether to persist, default true
   */
  emitAndPersistMessage(message: IResponseMessage, persist?: boolean): void;

  /**
   * Directly persist message to database (without sending to frontend)
   * @param message Message to persist (TMessage format)
   */
  persistMessage(message: TMessage): void;

  /**
   * Add confirmation item to confirmation list (managed by BaseAgentManager)
   * @param data Confirmation item data
   */
  addConfirmation(data: IConfirmation): void;

  /**
   * Send message back to AI agent (for system response feedback)
   * @param content Message content to send
   */
  sendMessageToAgent?(content: string): Promise<void>;

  // ===== ApprovalStore integration =====

  /**
   * Check if an exec command has been approved for session (from ApprovalStore cache)
   * @returns true if auto-approve should be used, false if user confirmation needed
   */
  checkExecApproval?(command: string | string[], cwd?: string): boolean;

  /**
   * Check if file changes have been approved for session (from ApprovalStore cache)
   * @returns true if auto-approve should be used, false if user confirmation needed
   */
  checkPatchApproval?(files: string[]): boolean;

  /**
   * Check if an exec command has been rejected for session (from ApprovalStore cache)
   * @returns true if auto-reject should be used, false if user confirmation needed
   */
  checkExecRejection?(command: string | string[], cwd?: string): boolean;

  /**
   * Check if file changes have been rejected for session (from ApprovalStore cache)
   * @returns true if auto-reject should be used, false if user confirmation needed
   */
  checkPatchRejection?(files: string[]): boolean;

  /**
   * Auto-confirm a permission request (used when ApprovalStore has cached approval/rejection)
   * @param callId The call ID to auto-confirm
   * @param decision The decision to send ('allow_always' or 'reject_always')
   */
  autoConfirm?(callId: string, decision: string): void;
}
