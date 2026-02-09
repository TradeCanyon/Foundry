/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IProjectInfo } from '@/common/ipcBridge';
import * as ProjectService from '../services/projectService';
import { getDatabase } from '@process/database';

/**
 * Convert internal Project to IPC-friendly IProjectInfo.
 */
function toProjectInfo(p: ProjectService.Project): IProjectInfo {
  return {
    workspace: p.workspace,
    name: p.metadata.name,
    description: p.metadata.description,
    type: p.metadata.type,
    goals: p.metadata.goals,
    created: p.metadata.created,
    lastActive: p.metadata.lastActive,
    archived: p.metadata.archived,
    skills: p.skills,
    hasInstructions: p.instructions !== null && p.instructions.length > 0,
  };
}

export function initProjectBridge(): void {
  // Detect if workspace has a .foundry/ project
  ipcBridge.project.detect.provider(async ({ workspace }) => {
    return ProjectService.detectProject(workspace);
  });

  // Initialize a new project
  ipcBridge.project.init.provider(async ({ workspace, name, description, type, goals }) => {
    try {
      ProjectService.initProject(workspace, { name, description, type, goals });
      ProjectService.registerWorkspace(workspace);
      const project = ProjectService.readProject(workspace);
      if (!project) return { success: false, msg: 'Project created but could not be read back' };
      return { success: true, data: toProjectInfo(project) };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, msg };
    }
  });

  // Read a project's info
  ipcBridge.project.read.provider(async ({ workspace }) => {
    try {
      const project = ProjectService.readProject(workspace);
      if (!project) return { success: false, msg: 'No project found at this workspace' };
      return { success: true, data: toProjectInfo(project) };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, msg };
    }
  });

  // List all known projects
  ipcBridge.project.list.provider(async () => {
    try {
      // Scan known workspaces from recent conversations to discover projects
      syncKnownWorkspaces();
      const projects = ProjectService.listProjects();
      return { success: true, data: projects.map(toProjectInfo) };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, msg };
    }
  });

  // Archive a project
  ipcBridge.project.archive.provider(async ({ workspace }) => {
    try {
      ProjectService.archiveProject(workspace);
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, msg };
    }
  });

  // Delete a project's .foundry/ directory
  ipcBridge.project.remove.provider(async ({ workspace }) => {
    try {
      ProjectService.deleteProject(workspace);
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, msg };
    }
  });

  // Get conversations for a given workspace (multi-chat per project)
  ipcBridge.project.getConversations.provider(async ({ workspace }) => {
    try {
      const db = getDatabase();
      const result = db.getUserConversations(undefined, 0, 10000);
      const allConversations = result.data || [];
      return allConversations.filter((c) => c.extra?.workspace === workspace);
    } catch {
      return [];
    }
  });
}

/**
 * Sync known workspaces from recent conversations in the database.
 * This ensures listProjects() can discover projects even after app restart.
 */
function syncKnownWorkspaces(): void {
  try {
    const db = getDatabase();
    const result = db.getUserConversations(undefined, 0, 10000);
    const allConversations = result.data || [];
    for (const conv of allConversations) {
      const workspace = conv.extra?.workspace;
      if (workspace && typeof workspace === 'string') {
        ProjectService.registerWorkspace(workspace);
      }
    }
  } catch {
    // Non-critical — projects just won't show up in list until a conversation opens
  }
}
