import * as fs from 'fs';
import * as path from 'path';
import { execSync, execFileSync } from 'child_process';
import { ToolDefinition, ToolResult, ToolCall, PermissionsConfig, redactSecrets, isPrivateIP } from '@pulsesparkai/shared';
import { isPathAllowed, isCommandAllowed, matchesDenyPattern, isProtectedPath } from './permissions';
import { analyzeCommand, isNetworkCommand } from './command-parser';
import { createTwoFilesPatch } from 'diff';

const MAX_BUFFER = 5 * 1024 * 1024; // 5 MB

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
  {
    name: 'fetch_url',
    description: 'Fetch a web page and return its text content. Requires network_access permission.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
  },
  {
    name: 'str_replace',
    description: 'Replace a specific string in a file. More precise than write_file — only changes the targeted text. Requires approval.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        old_string: { type: 'string', description: 'Exact string to find (must be unique in the file unless replace_all is true)' },
        new_string: { type: 'string', description: 'Replacement string' },
        replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false)' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'check_errors',
    description: 'Run the project linter/type-checker and return errors. Auto-detects TypeScript, ESLint, Python, etc.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Optional file or directory to check' },
      },
      required: [],
    },
  },
  {
    name: 'git_status',
    description: 'Show git status: current branch, staged/unstaged changes, untracked files.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'git_diff',
    description: 'Show git diff of working tree changes.',
    parameters: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Optional specific file to diff' },
        staged: { type: 'boolean', description: 'Show staged changes (default: false)' },
      },
      required: [],
    },
  },
  {
    name: 'git_log',
    description: 'Show recent git commits.',
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of commits to show (default: 10)' },
      },
      required: [],
    },
  },
  {
    name: 'git_commit',
    description: 'Stage all changes and create a git commit. Requires approval.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Commit message' },
      },
      required: ['message'],
    },
  },
  {
    name: 'search_code',
    description: 'Smart code search: find function/class definitions, references, or search with surrounding context.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Symbol or pattern to search for' },
        mode: { type: 'string', description: '"definition" (find where defined), "references" (find usages), or "context" (search with surrounding lines). Default: "context"' },
        globs: { type: 'string', description: 'File glob pattern (e.g. "**/*.ts")' },
      },
      required: ['query'],
    },
  },
  {
    name: 'delegate_task',
    description: 'Spawn a sub-agent to handle a focused task. The sub-agent inherits your tools and permissions but has limited iterations. Use for independent sub-tasks during complex work.',
    parameters: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'What the sub-agent should accomplish' },
        context: { type: 'string', description: 'Optional context or relevant file paths to pass to the sub-agent' },
      },
      required: ['task'],
    },
  },
  {
    name: 'semantic_search',
    description: 'Search the codebase by meaning using TF-IDF similarity. Finds relevant code chunks even when the exact words differ. Best for "where does X happen?" or "how is Y implemented?" questions. Auto-indexes the repo on first use.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language query describing what you are looking for' },
        top_k: { type: 'number', description: 'Number of results to return (default: 8)' },
      },
      required: ['query'],
    },
  },
];

export async function executeTool(
  call: ToolCall,
  workspaceRoot: string,
  permissions: PermissionsConfig
): Promise<ToolResult> {
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
      case 'fetch_url':
        return await executeFetchUrl(
          call.id,
          args as { url: string },
          permissions
        );
      case 'str_replace':
        return executeStrReplace(
          call.id,
          args as { path: string; old_string: string; new_string: string; replace_all?: boolean },
          workspaceRoot,
          permissions
        );
      case 'check_errors':
        return executeCheckErrors(call.id, args as { path?: string }, workspaceRoot);
      case 'git_status':
        return executeGit(call.id, ['status', '--short', '--branch'], workspaceRoot);
      case 'git_diff': {
        const diffArgs = ['diff'];
        if ((args as { staged?: boolean }).staged) diffArgs.push('--staged');
        if ((args as { file?: string }).file) diffArgs.push((args as { file: string }).file);
        return executeGit(call.id, diffArgs, workspaceRoot);
      }
      case 'git_log': {
        const count = (args as { count?: number }).count || 10;
        return executeGit(call.id, ['log', `--oneline`, `-${count}`], workspaceRoot);
      }
      case 'git_commit': {
        const msg = (args as { message: string }).message;
        const addResult = executeGit(call.id, ['add', '-A'], workspaceRoot);
        if (addResult.error) return addResult;
        return executeGit(call.id, ['commit', '-m', msg], workspaceRoot);
      }
      case 'search_code':
        return executeSearchCode(
          call.id,
          args as { query: string; mode?: string; globs?: string },
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
  const resolvedPath = path.resolve(workspaceRoot, args.path);
  if (!isPathAllowed(resolvedPath, permissions, workspaceRoot)) {
    return { tool_call_id: callId, output: '', error: 'Path is outside allowed workspace' };
  }

  const realPath = fs.existsSync(resolvedPath) ? fs.realpathSync(resolvedPath) : resolvedPath;
  if (!isPathAllowed(realPath, permissions, workspaceRoot)) {
    return { tool_call_id: callId, output: '', error: 'Resolved path is outside allowed workspace' };
  }

  const entries = fs.readdirSync(realPath, { withFileTypes: true });
  const listing = entries.map((e) => `${e.isDirectory() ? '[dir]' : '[file]'} ${e.name}`);
  return { tool_call_id: callId, output: listing.join('\n') };
}

function executeReadFile(
  callId: string,
  args: { path: string },
  workspaceRoot: string,
  permissions: PermissionsConfig
): ToolResult {
  const resolvedPath = path.resolve(workspaceRoot, args.path);
  if (!isPathAllowed(resolvedPath, permissions, workspaceRoot)) {
    return { tool_call_id: callId, output: '', error: 'Path is outside allowed workspace' };
  }

  const realPath = fs.existsSync(resolvedPath) ? fs.realpathSync(resolvedPath) : resolvedPath;
  if (!isPathAllowed(realPath, permissions, workspaceRoot)) {
    return { tool_call_id: callId, output: '', error: 'Resolved path is outside allowed workspace' };
  }

  const content = fs.readFileSync(realPath, 'utf-8');
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

  const resolvedPath = path.resolve(workspaceRoot, args.path);
  if (!isPathAllowed(resolvedPath, permissions, workspaceRoot)) {
    return { tool_call_id: callId, output: '', error: 'Path is outside allowed workspace' };
  }

  if (isProtectedPath(resolvedPath, workspaceRoot)) {
    return { tool_call_id: callId, output: '', error: 'Cannot write to protected .rivet/ directory' };
  }

  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(resolvedPath, args.content, 'utf-8');
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

  const analysis = analyzeCommand(args.command);
  if (!analysis.safe) {
    return {
      tool_call_id: callId,
      output: '',
      error: `Command blocked by safety analysis: ${analysis.reasons.join('; ')}`,
    };
  }

  if (!permissions.network_access && isNetworkCommand(args.command)) {
    return { tool_call_id: callId, output: '', error: 'Network access is disabled in permissions' };
  }

  const cwd = args.cwd ? path.resolve(workspaceRoot, args.cwd) : workspaceRoot;

  try {
    const output = execSync(args.command, {
      cwd,
      timeout: 30000,
      maxBuffer: MAX_BUFFER,
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

  const denyMatch = matchesDenyPattern(args.query, permissions.deny_patterns);
  if (denyMatch) {
    return { tool_call_id: callId, output: '', error: `Search query matches deny pattern: ${denyMatch}` };
  }

  const globPattern = args.globs || '**/*';

  try {
    let output: string;

    if (process.platform === 'win32') {
      output = execFileSync('findstr', ['/s', '/n', '/r', args.query, globPattern], {
        cwd: workspaceRoot,
        timeout: 15000,
        maxBuffer: MAX_BUFFER,
        encoding: 'utf-8',
      });
    } else {
      output = execFileSync('grep', ['-rn', '--include=' + globPattern, '--', args.query, '.'], {
        cwd: workspaceRoot,
        timeout: 15000,
        maxBuffer: MAX_BUFFER,
        encoding: 'utf-8',
      });
      const lines = output.split('\n');
      if (lines.length > 50) {
        output = lines.slice(0, 50).join('\n') + `\n... (${lines.length - 50} more matches truncated)`;
      }
    }

    return { tool_call_id: callId, output: redactSecrets(output) };
  } catch {
    return { tool_call_id: callId, output: 'No matches found' };
  }
}

const MAX_FETCH_SIZE = 100_000;

const BLOCKED_TLDS = ['.onion', '.i2p'];

const BLOCKED_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com',
  'youporn.com', 'tube8.com', 'spankbang.com', 'chaturbate.com', 'stripchat.com',
  'livejasmin.com', 'bongacams.com', 'cam4.com', 'myfreecams.com', 'onlyfans.com',
  'fansly.com', 'manyvids.com', 'brazzers.com', 'bangbros.com', 'realitykings.com',
  'naughtyamerica.com', 'mofos.com', 'babes.com', 'twistys.com', 'digitalplayground.com',
  'wicked.com', 'evilangel.com', 'kink.com', 'clips4sale.com', 'iwantclips.com',
  'rule34.xxx', 'e-hentai.org', 'nhentai.net', 'gelbooru.com', 'danbooru.donmai.us',
  'thepiratebay.org', 'rarbg.to', '1337x.to', 'kickasstorrents.to',
  'silkroad.com', 'darkweb.com', 'dread.onion',
  'buycc.com', 'cardingforum.com',
];

const BLOCKED_URL_PATTERNS = [
  /\.(onion|i2p)(\/|$)/i,
  /\b(porn|xxx|nsfw|hentai|nude|naked|sex|adult[\-_]?content)\b/i,
  /\b(darknet|darkweb|dark[\-_]market)\b/i,
  /\b(buy[\-_]?drugs|buy[\-_]?weapons|buy[\-_]?guns)\b/i,
  /\b(carding|fullz|cvv[\-_]?shop|dumps[\-_]?shop)\b/i,
];

function isUrlBlocked(urlStr: string, permissions?: PermissionsConfig): string | null {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return 'Invalid URL';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `Blocked protocol: ${parsed.protocol} (only http/https allowed)`;
  }

  const hostname = parsed.hostname.toLowerCase();

  if (isPrivateIP(hostname)) {
    return `Blocked: private/internal address (${hostname})`;
  }

  if (permissions?.allowed_domains && permissions.allowed_domains.length > 0) {
    const domainAllowed = permissions.allowed_domains.some((d) => {
      const allowed = d.toLowerCase();
      return hostname === allowed || hostname.endsWith('.' + allowed);
    });
    if (!domainAllowed) {
      return `Blocked: domain "${hostname}" is not in the allowed_domains list`;
    }
    return null;
  }

  for (const tld of BLOCKED_TLDS) {
    if (hostname.endsWith(tld)) {
      return `Blocked: dark web domain (${tld})`;
    }
  }

  for (const domain of BLOCKED_DOMAINS) {
    if (hostname === domain || hostname.endsWith('.' + domain)) {
      return `Blocked: restricted domain (${domain})`;
    }
  }

  const fullUrl = urlStr.toLowerCase();
  for (const pattern of BLOCKED_URL_PATTERNS) {
    if (pattern.test(fullUrl)) {
      return 'Blocked: URL matches restricted content pattern';
    }
  }

  return null;
}

const FETCH_RATE_WINDOW_MS = 60_000;
const FETCH_RATE_MAX = 10;
const fetchTimestamps: number[] = [];

function checkFetchRateLimit(): string | null {
  const now = Date.now();
  while (fetchTimestamps.length > 0 && now - fetchTimestamps[0] > FETCH_RATE_WINDOW_MS) {
    fetchTimestamps.shift();
  }
  if (fetchTimestamps.length >= FETCH_RATE_MAX) {
    return `Rate limit: max ${FETCH_RATE_MAX} fetch requests per minute`;
  }
  fetchTimestamps.push(now);
  return null;
}

async function executeFetchUrl(
  callId: string,
  args: { url: string },
  permissions: PermissionsConfig
): Promise<ToolResult> {
  if (!permissions.network_access) {
    return { tool_call_id: callId, output: '', error: 'Network access is disabled in permissions' };
  }

  const rateLimited = checkFetchRateLimit();
  if (rateLimited) {
    return { tool_call_id: callId, output: '', error: rateLimited };
  }

  const blocked = isUrlBlocked(args.url, permissions);
  if (blocked) {
    return { tool_call_id: callId, output: '', error: blocked };
  }

  try {
    new URL(args.url);
  } catch {
    return { tool_call_id: callId, output: '', error: 'Invalid URL' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(args.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Rivet/1.0 (CLI Agent)' },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return { tool_call_id: callId, output: '', error: `HTTP ${resp.status}: ${resp.statusText}` };
    }

    const contentType = resp.headers.get('content-type') || '';
    const raw = await resp.text();

    let text: string;
    if (contentType.includes('text/html')) {
      text = stripHtml(raw);
    } else {
      text = raw;
    }

    if (text.length > MAX_FETCH_SIZE) {
      text = text.slice(0, MAX_FETCH_SIZE) + `\n\n[Truncated: ${text.length} chars total]`;
    }

    return { tool_call_id: callId, output: text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { tool_call_id: callId, output: '', error: `Fetch failed: ${msg}` };
  }
}

function stripHtml(html: string): string {
  let text = html;
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n');
  return text.trim();
}

function executeStrReplace(
  callId: string,
  args: { path: string; old_string: string; new_string: string; replace_all?: boolean },
  workspaceRoot: string,
  permissions: PermissionsConfig
): ToolResult {
  if (!permissions.write_file) {
    return { tool_call_id: callId, output: '', error: 'File writing is disabled in permissions' };
  }

  const resolvedPath = path.resolve(workspaceRoot, args.path);
  if (!isPathAllowed(resolvedPath, permissions, workspaceRoot)) {
    return { tool_call_id: callId, output: '', error: 'Path is outside allowed workspace' };
  }
  if (isProtectedPath(resolvedPath, workspaceRoot)) {
    return { tool_call_id: callId, output: '', error: 'Cannot write to protected .rivet/ directory' };
  }

  if (!fs.existsSync(resolvedPath)) {
    return { tool_call_id: callId, output: '', error: `File not found: ${args.path}` };
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const occurrences = content.split(args.old_string).length - 1;

  if (occurrences === 0) {
    return { tool_call_id: callId, output: '', error: 'old_string not found in file' };
  }
  if (occurrences > 1 && !args.replace_all) {
    return { tool_call_id: callId, output: '', error: `old_string found ${occurrences} times. Set replace_all=true or provide a more unique string.` };
  }

  const newContent = args.replace_all
    ? content.split(args.old_string).join(args.new_string)
    : content.replace(args.old_string, args.new_string);

  fs.writeFileSync(resolvedPath, newContent, 'utf-8');
  const replaced = args.replace_all ? occurrences : 1;
  return { tool_call_id: callId, output: `Replaced ${replaced} occurrence(s) in ${args.path}` };
}

function executeCheckErrors(
  callId: string,
  args: { path?: string },
  workspaceRoot: string
): ToolResult {
  const checks: Array<{ test: string; cmd: string[] }> = [
    { test: 'tsconfig.json', cmd: ['npx', 'tsc', '--noEmit'] },
    { test: '.eslintrc', cmd: ['npx', 'eslint', '.', '--max-warnings=0'] },
    { test: '.eslintrc.js', cmd: ['npx', 'eslint', '.', '--max-warnings=0'] },
    { test: '.eslintrc.json', cmd: ['npx', 'eslint', '.', '--max-warnings=0'] },
    { test: 'eslint.config.js', cmd: ['npx', 'eslint', '.', '--max-warnings=0'] },
    { test: 'pyproject.toml', cmd: ['ruff', 'check', '.'] },
    { test: 'Cargo.toml', cmd: ['cargo', 'check'] },
  ];

  for (const { test, cmd } of checks) {
    if (fs.existsSync(path.join(workspaceRoot, test))) {
      try {
        const output = execFileSync(cmd[0], [...cmd.slice(1), ...(args.path ? [args.path] : [])], {
          cwd: workspaceRoot,
          timeout: 60000,
          maxBuffer: MAX_BUFFER,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { tool_call_id: callId, output: output || 'No errors found.' };
      } catch (err: unknown) {
        const execErr = err as { stdout?: string; stderr?: string };
        const combined = (execErr.stdout || '') + '\n' + (execErr.stderr || '');
        return { tool_call_id: callId, output: combined.trim() };
      }
    }
  }

  return { tool_call_id: callId, output: '', error: 'No supported linter/type-checker detected (looked for tsconfig.json, eslintrc, pyproject.toml, Cargo.toml)' };
}

function executeGit(
  callId: string,
  gitArgs: string[],
  workspaceRoot: string
): ToolResult {
  try {
    const output = execFileSync('git', gitArgs, {
      cwd: workspaceRoot,
      timeout: 15000,
      maxBuffer: MAX_BUFFER,
      encoding: 'utf-8',
    });
    return { tool_call_id: callId, output: redactSecrets(output) };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; message: string };
    return {
      tool_call_id: callId,
      output: execErr.stdout || '',
      error: execErr.stderr || execErr.message,
    };
  }
}

const DEFINITION_PATTERNS: Record<string, string[]> = {
  ts: ['(export\\s+)?(function|const|let|var|class|interface|type|enum)\\s+SYMBOL'],
  js: ['(export\\s+)?(function|const|let|var|class)\\s+SYMBOL'],
  py: ['(def|class|async\\s+def)\\s+SYMBOL'],
  rs: ['(pub\\s+)?(fn|struct|enum|trait|impl|type|const|static)\\s+SYMBOL'],
  go: ['(func|type|var|const)\\s+SYMBOL'],
  java: ['(public|private|protected)?\\s*(static\\s+)?(class|interface|enum|void|int|String|boolean|\\w+)\\s+SYMBOL'],
};

function executeSearchCode(
  callId: string,
  args: { query: string; mode?: string; globs?: string },
  workspaceRoot: string,
  permissions: PermissionsConfig
): ToolResult {
  if (!isPathAllowed('.', permissions, workspaceRoot)) {
    return { tool_call_id: callId, output: '', error: 'Workspace access denied' };
  }

  const mode = args.mode || 'context';
  const globPattern = args.globs || '**/*';
  const symbol = args.query;

  let pattern: string;
  if (mode === 'definition') {
    const ext = globPattern.split('.').pop() || 'ts';
    const patterns = DEFINITION_PATTERNS[ext] || DEFINITION_PATTERNS['ts'];
    pattern = patterns.map(p => p.replace('SYMBOL', symbol)).join('|');
  } else {
    pattern = symbol;
  }

  const grepArgs = mode === 'context'
    ? ['-rn', '-C', '3', '--include=' + globPattern, '--', pattern, '.']
    : ['-rn', '--include=' + globPattern, '--', pattern, '.'];

  try {
    let output = execFileSync('grep', grepArgs, {
      cwd: workspaceRoot,
      timeout: 15000,
      maxBuffer: MAX_BUFFER,
      encoding: 'utf-8',
    });
    const lines = output.split('\n');
    if (lines.length > 80) {
      output = lines.slice(0, 80).join('\n') + `\n... (${lines.length - 80} more lines)`;
    }
    return { tool_call_id: callId, output: redactSecrets(output) };
  } catch {
    return { tool_call_id: callId, output: 'No matches found' };
  }
}

export const READ_ONLY_TOOLS = new Set([
  'list_dir', 'read_file', 'search_in_files', 'search_code',
  'check_errors', 'git_status', 'git_diff', 'git_log', 'fetch_url',
  'semantic_search',
]);

export function generateDiff(filePath: string, oldContent: string, newContent: string): string {
  return createTwoFilesPatch(
    `a/${filePath}`,
    `b/${filePath}`,
    oldContent,
    newContent,
    undefined,
    undefined,
    { context: 3 }
  );
}
