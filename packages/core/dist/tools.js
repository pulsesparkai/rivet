"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITIONS = void 0;
exports.executeTool = executeTool;
exports.generateDiff = generateDiff;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const shared_1 = require("@pulsespark/shared");
const permissions_1 = require("./permissions");
exports.TOOL_DEFINITIONS = [
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
function executeTool(call, workspaceRoot, permissions) {
    const { name, arguments: args } = call;
    try {
        switch (name) {
            case 'list_dir':
                return executeListDir(call.id, args, workspaceRoot, permissions);
            case 'read_file':
                return executeReadFile(call.id, args, workspaceRoot, permissions);
            case 'write_file':
                return executeWriteFile(call.id, args, workspaceRoot, permissions);
            case 'run_command':
                return executeRunCommand(call.id, args, workspaceRoot, permissions);
            case 'search_in_files':
                return executeSearchInFiles(call.id, args, workspaceRoot, permissions);
            default:
                return { tool_call_id: call.id, output: '', error: `Unknown tool: ${name}` };
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { tool_call_id: call.id, output: '', error: msg };
    }
}
function executeListDir(callId, args, workspaceRoot, permissions) {
    const targetPath = path.resolve(workspaceRoot, args.path);
    if (!(0, permissions_1.isPathAllowed)(args.path, permissions, workspaceRoot)) {
        return { tool_call_id: callId, output: '', error: 'Path is outside allowed workspace' };
    }
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const listing = entries.map((e) => `${e.isDirectory() ? '[dir]' : '[file]'} ${e.name}`);
    return { tool_call_id: callId, output: listing.join('\n') };
}
function executeReadFile(callId, args, workspaceRoot, permissions) {
    if (!(0, permissions_1.isPathAllowed)(args.path, permissions, workspaceRoot)) {
        return { tool_call_id: callId, output: '', error: 'Path is outside allowed workspace' };
    }
    const fullPath = path.resolve(workspaceRoot, args.path);
    const content = fs.readFileSync(fullPath, 'utf-8');
    return { tool_call_id: callId, output: (0, shared_1.redactSecrets)(content) };
}
function executeWriteFile(callId, args, workspaceRoot, permissions) {
    if (!permissions.write_file) {
        return { tool_call_id: callId, output: '', error: 'File writing is disabled in permissions' };
    }
    if (!(0, permissions_1.isPathAllowed)(args.path, permissions, workspaceRoot)) {
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
function executeRunCommand(callId, args, workspaceRoot, permissions) {
    const check = (0, permissions_1.isCommandAllowed)(args.command, permissions);
    if (!check.allowed) {
        return { tool_call_id: callId, output: '', error: check.reason || 'Command not allowed' };
    }
    const cwd = args.cwd ? path.resolve(workspaceRoot, args.cwd) : workspaceRoot;
    try {
        const output = (0, child_process_1.execSync)(args.command, {
            cwd,
            timeout: 30000,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { tool_call_id: callId, output: (0, shared_1.redactSecrets)(output) };
    }
    catch (err) {
        const execErr = err;
        const stdout = (0, shared_1.redactSecrets)(execErr.stdout || '');
        const stderr = (0, shared_1.redactSecrets)(execErr.stderr || '');
        return {
            tool_call_id: callId,
            output: stdout,
            error: stderr || execErr.message,
        };
    }
}
function executeSearchInFiles(callId, args, workspaceRoot, permissions) {
    if (!(0, permissions_1.isPathAllowed)('.', permissions, workspaceRoot)) {
        return { tool_call_id: callId, output: '', error: 'Workspace access denied' };
    }
    const globPattern = args.globs || '**/*';
    const cmd = process.platform === 'win32'
        ? `findstr /s /n /r "${args.query}" ${globPattern}`
        : `grep -rn "${args.query.replace(/"/g, '\\"')}" --include="${globPattern}" . 2>/dev/null | head -50`;
    try {
        const output = (0, child_process_1.execSync)(cmd, {
            cwd: workspaceRoot,
            timeout: 15000,
            encoding: 'utf-8',
        });
        return { tool_call_id: callId, output: (0, shared_1.redactSecrets)(output) };
    }
    catch {
        return { tool_call_id: callId, output: 'No matches found' };
    }
}
function generateDiff(filePath, oldContent, newContent) {
    const lines = [];
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    lines.push(`--- a/${filePath}`);
    lines.push(`+++ b/${filePath}`);
    const maxLen = Math.max(oldLines.length, newLines.length);
    let chunkStart = -1;
    let chunkLines = [];
    for (let i = 0; i < maxLen; i++) {
        const oldLine = i < oldLines.length ? oldLines[i] : undefined;
        const newLine = i < newLines.length ? newLines[i] : undefined;
        if (oldLine !== newLine) {
            if (chunkStart === -1)
                chunkStart = i;
            if (oldLine !== undefined)
                chunkLines.push(`- ${oldLine}`);
            if (newLine !== undefined)
                chunkLines.push(`+ ${newLine}`);
        }
        else {
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
