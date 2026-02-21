import * as fs from 'fs';
import * as path from 'path';
import {
  RIVET_DIR,
  CONFIG_FILE,
  PERMISSIONS_FILE,
  MEMORY_FILE,
  RUNS_DIR,
  DEFAULT_PERMISSIONS,
  DEFAULT_CONFIG,
} from '@pulsesparkai/shared';

export function initRivet(workspaceRoot: string): { created: string[]; existed: string[] } {
  const rivetDir = path.join(workspaceRoot, RIVET_DIR);
  const created: string[] = [];
  const existed: string[] = [];

  if (!fs.existsSync(rivetDir)) {
    fs.mkdirSync(rivetDir, { recursive: true });
    created.push(RIVET_DIR);
  } else {
    existed.push(RIVET_DIR);
  }

  const runsDir = path.join(rivetDir, RUNS_DIR);
  if (!fs.existsSync(runsDir)) {
    fs.mkdirSync(runsDir, { recursive: true });
    created.push(`${RIVET_DIR}/${RUNS_DIR}`);
  } else {
    existed.push(`${RIVET_DIR}/${RUNS_DIR}`);
  }

  const configPath = path.join(rivetDir, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    created.push(`${RIVET_DIR}/${CONFIG_FILE}`);
  } else {
    existed.push(`${RIVET_DIR}/${CONFIG_FILE}`);
  }

  const permPath = path.join(rivetDir, PERMISSIONS_FILE);
  if (!fs.existsSync(permPath)) {
    const perms = { ...DEFAULT_PERMISSIONS, workspace_root: workspaceRoot };
    fs.writeFileSync(permPath, JSON.stringify(perms, null, 2), 'utf-8');
    created.push(`${RIVET_DIR}/${PERMISSIONS_FILE}`);
  } else {
    existed.push(`${RIVET_DIR}/${PERMISSIONS_FILE}`);
  }

  const memPath = path.join(rivetDir, MEMORY_FILE);
  if (!fs.existsSync(memPath)) {
    fs.writeFileSync(memPath, JSON.stringify({ entries: [] }, null, 2), 'utf-8');
    created.push(`${RIVET_DIR}/${MEMORY_FILE}`);
  } else {
    existed.push(`${RIVET_DIR}/${MEMORY_FILE}`);
  }

  return { created, existed };
}

export function isInitialized(workspaceRoot: string): boolean {
  const rivetDir = path.join(workspaceRoot, RIVET_DIR);
  return fs.existsSync(rivetDir) && fs.existsSync(path.join(rivetDir, CONFIG_FILE));
}
