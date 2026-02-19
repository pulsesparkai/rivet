import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ToolDefinition, ToolResult, ToolCall, PermissionsConfig, redactSecrets } from '@pulsespark/shared';
import { isPathAllowed, isCommandAllowed } from './permissions';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'list_dir',
    description: 'List files and directories at the given path',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list' },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to read' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file. Requires approval with diff preview.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'run_command',
    description: 'Execute a shell command in the workspace',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        cwd: { type: 'string', description: 'Working directory (optional)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'search_in_files',
    description: 'Search for a pattern in files matching a glob',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search pattern (regex)' },
        globs: { type: 'string', description: 'File glob pattern (e.g. "**/*.ts")' },
      },
      required: ['query'],
    },
  },
];

export function executeTool(
  call: ToolCall,
  workspaceRoot: string,
  permissions: PermissionsConfig
): ToolResult {
  const { name, arguments: args } = call;

  try {
    switch (name) {
      case 'list_dir':
        return executeListDir(call.id, args as { path: string }, workspaceRoot, permissions);
      case 'read_file':
        return executeReadFile(call.id, args as { path: string }, workspaceRoot, permissions);
      case 'write_file':
        return executeWriteFile(
          call.id,
          args as { path: string; content: string },
          workspaceRoot,
          permissions
        );
      case 'run_command':
        return executeRunCommand(
          call.id,
          args as { command: string; cwd?: string },
          workspaceRoot,
          permissions
        );
      case 'search_in_files':
        return executeSearchInFiles(
          call.id,
          args as { query: string; globs?: string },
          workspaceRoot,
          permissions
        );
      default:
        return { tool_call_id: call.id, output: '', error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { tool_call_id: call.id, output: '', error: msg };
  }
}

function executeListDir(
  callId: string,
  args: { path: string },
  workspaceRoot: string,
  permissions: PermissionsConfig
): ToolResult {
  const targetPath = path.resolve(workspaceRoot, args.path);
  if (!isPathAllowed(args.path, permissions, workspaceRoot)) {
    return { tool_call_id: callId, output: '', error: 'Path is outside allowed workspace' };
  }

  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  const listing = entries.map((e) => `${e.isDirectory() ? '[dir]' : '[file]'} ${e.name}`);
  return { tool_call_id: callId, output: listing.join('\n') };
}

function executeReadFile(
  callId: string,
  args: { path: string },
  workspaceRoot: string,
  permissions: PermissionsConfig
): ToolResult {
  if (!isPathAllowed(args.path, permissions, workspaceRoot)) {
    return { tool_call_id: callId, output: '', error: 'Path is outside allowed workspace' };
  }

  const fullPath = path.resolve(workspaceRoot, args.path);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return { tool_call_id: callId, output: redactSecrets(content) };
}

function executeWriteFile(
  callId: string,
  args: { path: string; content: string },
  workspaceRoot: string,
  permissions: PermissionsConfig
): ToolResult {
  if (!permissions.write_file) {
    return { tool_call_id: callId, output: '', error: 'File writing is disabled in permissions' };
  }

  if (!isPathAllowed(args.path, permissions, workspaceRoot)) {
    return { tool_call_id: callId, output: '', error: 'Path is outside allowed workspace' };
  }

  const fullPath = path.resolve(workspaceRoot, args.path);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, args.content, 'utf-8');
  return { tool_call_id: callId, output: `File written: ${args.path}` };
}

function executeRunCommand(
  callId: string,
  args: { command: string; cwd?: string },
  workspaceRoot: string,
  permissions: PermissionsConfig
): ToolResult {
  const check = isCommandAllowed(args.command, permissions);
  if (!check.allowed) {
    return { tool_call_id: callId, output: '', error: check.reason || 'Command not allowed' };
  }

  const cwd = args.cwd ? path.resolve(workspaceRoot, args.cwd) : workspaceRoot;

  try {
    const output = execSync(args.command, {
      cwd,
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { tool_call_id: callId, output: redactSecrets(output) };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; message: string };
    const stdout = redactSecrets(execErr.stdout || '');
    const stderr = redactSecrets(execErr.stderr || '');
    return {
      tool_call_id: callId,
      output: stdout,
      error: stderr || execErr.message,
    };
  }
}

function executeSearchInFiles(
  callId: string,
  args: { query: string; globs?: string },
  workspaceRoot: string,
  permissions: PermissionsConfig
): ToolResult {
  if (!isPathAllowed('.', permissions, workspaceRoot)) {
    return { tool_call_id: callId, output: '', error: 'Workspace access denied' };
  }

  const globPattern = args.globs || '**/*';
  const cmd = process.platform === 'win32'
    ? `findstr /s /n /r "${args.query}" ${globPattern}`
    : `grep -rn "${args.query.replace(/"/g, '\\"')}" --include="${globPattern}" . 2>/dev/null | head -50`;

  try {
    const output = execSync(cmd, {
      cwd: workspaceRoot,
      timeout: 15000,
      encoding: 'utf-8',
    });
    return { tool_call_id: callId, output: redactSecrets(output) };
  } catch {
    return { tool_call_id: callId, output: 'No matches found' };
  }
}

export function generateDiff(filePath: string, oldContent: string, newContent: string): string {
  const lines: string[] = [];
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  lines.push(`--- a/${filePath}`);
  lines.push(`+++ b/${filePath}`);

  const maxLen = Math.max(oldLines.length, newLines.length);
  let chunkStart = -1;
  let chunkLines: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;

    if (oldLine !== newLine) {
      if (chunkStart === -1) chunkStart = i;
      if (oldLine !== undefined) chunkLines.push(`- ${oldLine}`);
      if (newLine !== undefined) chunkLines.push(`+ ${newLine}`);
    } else {
      if (chunkLines.length > 0) {
        lines.push(`@@ -${chunkStart + 1} +${chunkStart + 1} @@`);
        lines.push(...chunkLines);
        chunkLines = [];
        chunkStart = -1;
      }
    }
  }

  if (chunkLines.length > 0) {
    lines.push(`@@ -${chunkStart + 1} +${chunkStart + 1} @@`);
    lines.push(...chunkLines);
  }

  return lines.join('\n');
}
