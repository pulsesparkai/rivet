import * as path from 'path';
import * as fs from 'fs';
import {
  PermissionsConfig,
  RIVET_DIR,
  PERMISSIONS_FILE,
  DEFAULT_PERMISSIONS,
} from '@pulsesparkai/shared';

const PROTECTED_PATHS = [RIVET_DIR];

export function loadPermissions(workspaceRoot: string): PermissionsConfig {
  const permPath = path.join(workspaceRoot, RIVET_DIR, PERMISSIONS_FILE);
  try {
    const raw = fs.readFileSync(permPath, 'utf-8');
    return JSON.parse(raw) as PermissionsConfig;
  } catch {
    return DEFAULT_PERMISSIONS as unknown as PermissionsConfig;
  }
}

export function savePermissions(workspaceRoot: string, config: PermissionsConfig): void {
  const permPath = path.join(workspaceRoot, RIVET_DIR, PERMISSIONS_FILE);
  fs.writeFileSync(permPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function isPathAllowed(
  targetPath: string,
  permissions: PermissionsConfig,
  workspaceRoot: string
): boolean {
  const resolved = path.resolve(workspaceRoot, targetPath);
  const resolvedRoot = path.resolve(workspaceRoot, permissions.workspace_root);

  if (!resolved.startsWith(resolvedRoot)) {
    return false;
  }

  if (permissions.allowed_paths.length === 0) {
    return true;
  }

  return permissions.allowed_paths.some((allowed: string) => {
    const resolvedAllowed = path.resolve(workspaceRoot, allowed);
    return resolved.startsWith(resolvedAllowed);
  });
}

export function isCommandAllowed(
  command: string,
  permissions: PermissionsConfig
): { allowed: boolean; reason?: string } {
  if (!permissions.run_command) {
    return { allowed: false, reason: 'Command execution is disabled in permissions' };
  }

  const denyMatch = matchesDenyPattern(command, permissions.deny_patterns);
  if (denyMatch) {
    return { allowed: false, reason: `Command matches deny pattern: ${denyMatch}` };
  }

  return { allowed: true };
}

export function matchesDenyPattern(command: string, denyPatterns: string[]): string | null {
  for (const pattern of denyPatterns) {
    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(command)) {
        return pattern;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function isCommandAllowlisted(command: string, allowlist: string[]): boolean {
  return allowlist.some((allowed: string) => {
    const trimmedCmd = command.trim();
    const trimmedAllowed = allowed.trim();
    return trimmedCmd === trimmedAllowed || trimmedCmd.startsWith(trimmedAllowed + ' ');
  });
}

export function isProtectedPath(targetPath: string, workspaceRoot: string): boolean {
  const resolved = path.resolve(workspaceRoot, targetPath);
  return PROTECTED_PATHS.some((p) => {
    const protectedResolved = path.resolve(workspaceRoot, p);
    return resolved === protectedResolved || resolved.startsWith(protectedResolved + path.sep);
  });
}

export function requiresApproval(
  toolName: string,
  permissions: PermissionsConfig,
  command?: string
): boolean {
  if (toolName === 'write_file' || toolName === 'str_replace') {
    return permissions.require_diff_approval;
  }

  if (toolName === 'run_command') {
    if (!permissions.require_approval_for_commands) return false;
    if (command && isCommandAllowlisted(command, permissions.allowlisted_commands)) return false;
    return true;
  }

  if (toolName === 'git_commit' || toolName === 'delegate_task') {
    return true;
  }

  return false;
}
