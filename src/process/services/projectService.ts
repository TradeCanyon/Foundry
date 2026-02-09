/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProjectService — Filesystem-based project detection, creation, and management.
 *
 * Projects are workspaces that contain a `.foundry/` directory with:
 *   project.json    — metadata (name, type, goals, timestamps)
 *   instructions.md — agent instructions (prepended to system prompt)
 *   skills/         — project-specific skill files (.md)
 *   memory/         — session summaries (Phase 5)
 *   logs/           — activity log (append-only)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ProjectMetadata {
  name: string;
  description: string;
  goals: string[];
  type: string;
  created: number;
  lastActive: number;
  archived: boolean;
}

export interface Project {
  workspace: string;
  metadata: ProjectMetadata;
  instructions: string | null;
  skills: string[];
}

const FOUNDRY_DIR = '.foundry';
const PROJECT_JSON = 'project.json';
const INSTRUCTIONS_MD = 'instructions.md';
const SKILLS_DIR = 'skills';
const MEMORY_DIR = 'memory';
const LOGS_DIR = 'logs';

/**
 * Check whether a workspace has a .foundry/ project folder.
 */
export function detectProject(workspace: string): boolean {
  try {
    const projectJsonPath = path.join(workspace, FOUNDRY_DIR, PROJECT_JSON);
    return fs.existsSync(projectJsonPath);
  } catch {
    return false;
  }
}

/**
 * Initialize a new project in the given workspace.
 * Creates .foundry/ directory structure with project.json and empty instructions.md.
 */
export function initProject(workspace: string, metadata: Omit<ProjectMetadata, 'created' | 'lastActive' | 'archived'>): ProjectMetadata {
  const foundryDir = path.join(workspace, FOUNDRY_DIR);

  if (fs.existsSync(path.join(foundryDir, PROJECT_JSON))) {
    throw new Error(`Project already exists at ${workspace}`);
  }

  // Create directory structure
  fs.mkdirSync(foundryDir, { recursive: true });
  fs.mkdirSync(path.join(foundryDir, SKILLS_DIR), { recursive: true });
  fs.mkdirSync(path.join(foundryDir, MEMORY_DIR), { recursive: true });
  fs.mkdirSync(path.join(foundryDir, LOGS_DIR), { recursive: true });

  const fullMetadata: ProjectMetadata = {
    ...metadata,
    created: Date.now(),
    lastActive: Date.now(),
    archived: false,
  };

  // Write project.json
  fs.writeFileSync(path.join(foundryDir, PROJECT_JSON), JSON.stringify(fullMetadata, null, 2), 'utf-8');

  // Create empty instructions.md with starter content
  const instructionsContent = `# ${metadata.name}\n\n${metadata.description || 'Project instructions for AI agents.'}\n`;
  fs.writeFileSync(path.join(foundryDir, INSTRUCTIONS_MD), instructionsContent, 'utf-8');

  return fullMetadata;
}

/**
 * Read a project's metadata, instructions, and skill file names.
 */
export function readProject(workspace: string): Project | null {
  const foundryDir = path.join(workspace, FOUNDRY_DIR);
  const projectJsonPath = path.join(foundryDir, PROJECT_JSON);

  try {
    if (!fs.existsSync(projectJsonPath)) return null;

    const raw = fs.readFileSync(projectJsonPath, 'utf-8');
    const metadata: ProjectMetadata = JSON.parse(raw);

    // Load instructions.md
    let instructions: string | null = null;
    const instructionsPath = path.join(foundryDir, INSTRUCTIONS_MD);
    if (fs.existsSync(instructionsPath)) {
      instructions = fs.readFileSync(instructionsPath, 'utf-8');
    }

    // List skill files
    const skillsDir = path.join(foundryDir, SKILLS_DIR);
    let skills: string[] = [];
    if (fs.existsSync(skillsDir)) {
      skills = fs.readdirSync(skillsDir).filter((f) => f.endsWith('.md'));
    }

    return { workspace, metadata, instructions, skills };
  } catch (error) {
    console.warn('[ProjectService] Failed to read project:', error);
    return null;
  }
}

/**
 * Update the lastActive timestamp on a project.
 */
export function touchProject(workspace: string): void {
  const projectJsonPath = path.join(workspace, FOUNDRY_DIR, PROJECT_JSON);
  try {
    if (!fs.existsSync(projectJsonPath)) return;
    const raw = fs.readFileSync(projectJsonPath, 'utf-8');
    const metadata: ProjectMetadata = JSON.parse(raw);
    metadata.lastActive = Date.now();
    fs.writeFileSync(projectJsonPath, JSON.stringify(metadata, null, 2), 'utf-8');
  } catch {
    // Non-critical — silently fail
  }
}

/**
 * Archive a project (sets archived flag, does not delete files).
 */
export function archiveProject(workspace: string): void {
  const projectJsonPath = path.join(workspace, FOUNDRY_DIR, PROJECT_JSON);
  if (!fs.existsSync(projectJsonPath)) {
    throw new Error(`No project found at ${workspace}`);
  }
  const raw = fs.readFileSync(projectJsonPath, 'utf-8');
  const metadata: ProjectMetadata = JSON.parse(raw);
  metadata.archived = true;
  fs.writeFileSync(projectJsonPath, JSON.stringify(metadata, null, 2), 'utf-8');
}

/**
 * Delete a project's .foundry/ directory. Does NOT delete the workspace itself.
 */
export function deleteProject(workspace: string): void {
  const foundryDir = path.join(workspace, FOUNDRY_DIR);
  if (!fs.existsSync(foundryDir)) {
    throw new Error(`No .foundry/ directory at ${workspace}`);
  }
  fs.rmSync(foundryDir, { recursive: true, force: true });
}

/**
 * Load project instructions content for agent prompt injection.
 * Returns null if no project or no instructions file.
 */
export function loadProjectInstructions(workspace: string): string | null {
  try {
    const instructionsPath = path.join(workspace, FOUNDRY_DIR, INSTRUCTIONS_MD);
    if (!fs.existsSync(instructionsPath)) return null;
    return fs.readFileSync(instructionsPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Load all project skill file contents for agent prompt injection.
 * Returns concatenated skill content or null if none.
 */
export function loadProjectSkills(workspace: string): string | null {
  try {
    const skillsDir = path.join(workspace, FOUNDRY_DIR, SKILLS_DIR);
    if (!fs.existsSync(skillsDir)) return null;

    const skillFiles = fs.readdirSync(skillsDir).filter((f) => f.endsWith('.md'));
    if (skillFiles.length === 0) return null;

    const contents = skillFiles.map((f) => {
      const content = fs.readFileSync(path.join(skillsDir, f), 'utf-8');
      return `## Skill: ${f.replace('.md', '')}\n${content}`;
    });

    return contents.join('\n\n');
  } catch {
    return null;
  }
}

// ---- Known projects registry (in-memory, scanned from recent conversations) ----

const knownWorkspaces = new Set<string>();

/**
 * Register a workspace path so it's included in listProjects scans.
 */
export function registerWorkspace(workspace: string): void {
  if (workspace) knownWorkspaces.add(workspace);
}

/**
 * List all known projects (detected from registered workspaces).
 * Returns projects sorted by lastActive descending.
 */
export function listProjects(): Project[] {
  const projects: Project[] = [];

  for (const workspace of knownWorkspaces) {
    if (!detectProject(workspace)) continue;
    const project = readProject(workspace);
    if (project && !project.metadata.archived) {
      projects.push(project);
    }
  }

  projects.sort((a, b) => b.metadata.lastActive - a.metadata.lastActive);
  return projects;
}
