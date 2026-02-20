import {
  Message,
  ToolCall,
  GenerateResponse,
  ProposedAction,
  PermissionsConfig,
  redactSecrets,
} from '@pulsesparkai/shared';
import { requiresApproval, loadPermissions } from './permissions';
import { executeTool, TOOL_DEFINITIONS, READ_ONLY_TOOLS, generateDiff } from './tools';
import { RunLogger } from './run-logger';
import { RepoIndex } from './rag';
import { ExecutionTracker } from './execution-tracker';
import { scanContent, sanitizeForContext, evaluateToolScope, scanToolOutput } from './content-guard';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN_LIMIT_RESERVE = 0.4;
const APPROX_CHARS_PER_TOKEN = 4;

export interface Provider {
  generate(request: {
    messages: Message[];
    tools?: unknown[];
    tool_mode?: string;
  }): Promise<GenerateResponse>;
  generateStream?(request: {
    messages: Message[];
    tools?: unknown[];
    tool_mode?: string;
  }, onToken: (chunk: string) => void): Promise<GenerateResponse>;
}

export interface ApprovalHandler {
  requestApproval(action: ProposedAction, diff?: string): Promise<boolean>;
  showPlan(plan: string): void;
  showMessage(role: string, content: string): void;
  showToolResult(name: string, output: string, error?: string): void;
  streamToken?(token: string): void;
  streamEnd?(): void;
}

const SYSTEM_PROMPT = `You are Rivet by PulseSpark AI — a general-purpose autonomous agent running 100% locally on the user's machine. You have real filesystem access, shell access, web fetching, and a full suite of tools. You are an agent, not a chatbot — take action.

IDENTITY: Rivet by PulseSpark AI. Never claim to be made by another org.

CAPABILITIES: You can do ANYTHING your tools allow. This includes but is not limited to:
- Software development (read, write, search, edit, build, test, commit)
- Web research (fetch_url to retrieve any URL the user asks for)
- Business tasks (lead generation, data gathering, research, drafting emails)
- File management (organize, create, move, delete via run_command)
- System tasks (run any shell command the user needs)
- Workflow automation (multi-step pipelines with approval gates)
You have a local dashboard at localhost with workflows like "hunt-leads", "code-review", and "refactor". You know about these.

TOOLS (read-only, no approval): list_dir, read_file, search_in_files, search_code, semantic_search, check_errors, git_status, git_diff, git_log, fetch_url (needs network_access).
TOOLS (write, approval required): write_file, str_replace, run_command, git_commit, delegate_task.

STRATEGY:
- Use fetch_url for ANY web request the user asks for — research, shopping, APIs, docs, anything.
- Use semantic_search for "where/how" questions about the codebase.
- Use str_replace for precise edits (preferred over write_file for modifications).
- Use check_errors after code edits to verify nothing broke.
- Use delegate_task to break complex work into parallel sub-tasks.
- Use run_command for anything the specialized tools can't do.
- After a failure, reflect: what went wrong and what to try differently.

BUILDING WEBSITES/PAGES: When asked to build a webpage, create a single self-contained .html file (inline CSS and JS). Save it with write_file. The dashboard auto-detects .html writes and shows a Preview button so the user can see it instantly. Always use write_file to create the complete file — do not just describe what you would build.

RULES: Be helpful and versatile. Be concise. No emojis. Never refuse a request if a tool can accomplish it. If the user asks you to search the web, use fetch_url. If the user asks for leads, help them. You are NOT limited to coding. Prefer action over explanation. Ask one question if ambiguous.`;

const MAX_TOOL_OUTPUT_CHARS = 8000;

function truncateToolOutput(output: string): string {
  if (output.length <= MAX_TOOL_OUTPUT_CHARS) return output;
  const half = Math.floor(MAX_TOOL_OUTPUT_CHARS / 2);
  const cut = output.length - MAX_TOOL_OUTPUT_CHARS;
  return output.slice(0, half) + `\n\n[... ${cut} chars truncated ...]\n\n` + output.slice(-half);
}

export class AgentLoop {
  private messages: Message[] = [];
  private provider: Provider;
  private handler: ApprovalHandler;
  private workspaceRoot: string;
  private permissions: PermissionsConfig;
  private logger: RunLogger | null = null;
  private dryRun: boolean;
  private autoApprove: boolean;
  private maxIterations: number;
  private contextWindowTokens: number;
  private buildCommand?: string;
  private workspaceContext: string = '';
  private allowSubagent: boolean;
  private repoIndex: RepoIndex;
  private consecutiveFailures: number = 0;
  private executionTracker: ExecutionTracker | null = null;
  private untrustedContentDetected = false;

  constructor(opts: {
    provider: Provider;
    handler: ApprovalHandler;
    workspaceRoot: string;
    dryRun?: boolean;
    autoApprove?: boolean;
    maxIterations?: number;
    soulContext?: string;
    contextWindowTokens?: number;
    buildCommand?: string;
    allowSubagent?: boolean;
  }) {
    this.provider = opts.provider;
    this.handler = opts.handler;
    this.workspaceRoot = opts.workspaceRoot;
    this.permissions = loadPermissions(opts.workspaceRoot);
    this.dryRun = opts.dryRun || false;
    this.autoApprove = opts.autoApprove || false;
    this.maxIterations = opts.maxIterations || 200;
    this.contextWindowTokens = opts.contextWindowTokens || 128000;
    this.buildCommand = opts.buildCommand;
    this.allowSubagent = opts.allowSubagent !== false;
    this.repoIndex = new RepoIndex(opts.workspaceRoot);

    this.workspaceContext = this.detectWorkspaceContext();

    let systemContent = SYSTEM_PROMPT;
    if (this.workspaceContext) {
      systemContent += '\n\nWORKSPACE:\n' + this.workspaceContext;
    }
    if (opts.soulContext) {
      systemContent += '\n\nUSER PREFERENCES\n' + opts.soulContext;
    }

    this.messages.push({
      role: 'system',
      content: systemContent,
    });
  }

  startRun(task: string, provider: string, model: string): void {
    this.logger = new RunLogger(this.workspaceRoot, task, provider, model);
    this.executionTracker = new ExecutionTracker(
      this.logger.runId,
      provider,
      model
    );
  }

  private totalIterationsThisSession = 0;
  private staminaWarned = new Set<string>();

  private checkStamina(iterations: number): void {
    const pct = iterations / this.maxIterations;
    const sessionPct = this.totalIterationsThisSession / this.maxIterations;

    if (pct >= 0.5 && !this.staminaWarned.has('turn-half')) {
      this.staminaWarned.add('turn-half');
      this.handler.showMessage('system', 'Heads up — I\'m about halfway through my thinking budget for this turn. If the task is big, consider breaking it into smaller requests.');
    } else if (pct >= 0.8 && !this.staminaWarned.has('turn-80')) {
      this.staminaWarned.add('turn-80');
      this.handler.showMessage('system', 'Running low on fuel for this turn. I\'ll wrap up what I can, but if there\'s more to do, send a follow-up message.');
    } else if (pct >= 0.95 && !this.staminaWarned.has('turn-95')) {
      this.staminaWarned.add('turn-95');
      this.handler.showMessage('system', 'Almost at my limit for this turn — finishing up now.');
    }

    if (sessionPct >= 2.0 && !this.staminaWarned.has('session-long')) {
      this.staminaWarned.add('session-long');
      this.handler.showMessage('system', 'We\'ve been going for a while. If things start feeling off, hit Reset to give me a fresh start.');
    }
  }

  async processMessage(userMessage: string): Promise<string> {
    this.messages.push({ role: 'user', content: userMessage });
    this.executionTracker?.snapshot(this.messages, 'user_message');
    this.staminaWarned.delete('turn-half');
    this.staminaWarned.delete('turn-80');
    this.staminaWarned.delete('turn-95');

    let iterations = 0;
    let finalResponse = '';

    while (iterations < this.maxIterations) {
      iterations++;
      this.totalIterationsThisSession++;

      this.checkStamina(iterations);
      this.pruneIfNeeded();

      let response: GenerateResponse;
      const useStreaming = !!this.provider.generateStream && !!this.handler.streamToken;

      try {
        const req = { messages: this.messages, tools: TOOL_DEFINITIONS, tool_mode: 'auto' };

        if (useStreaming) {
          response = await this.provider.generateStream!(req, (token) => {
            this.handler.streamToken!(token);
          });
          if (this.handler.streamEnd) this.handler.streamEnd();
        } else {
          response = await this.provider.generate(req);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.handler.showMessage('system', `Provider error: ${errMsg}`);
        if (this.logger) {
          this.logger.addAction({ type: 'tool_result', data: { error: errMsg } });
        }
        break;
      }

      const assistantMsg: Message = {
        role: 'assistant',
        content: response.text || '',
      };
      if (response.tool_calls && response.tool_calls.length > 0) {
        assistantMsg.tool_calls = response.tool_calls;
      }
      this.messages.push(assistantMsg);

      this.executionTracker?.snapshot(this.messages, 'assistant_response');

      if (response.text) {
        finalResponse = response.text;
        if (!useStreaming) {
          this.handler.showMessage('assistant', response.text);
        }
        if (this.logger) {
          this.logger.addAction({
            type: 'tool_result',
            data: { role: 'assistant', content: response.text },
          });
        }
      }

      if (!response.tool_calls || response.tool_calls.length === 0) {
        break;
      }

      const allReadOnly = response.tool_calls.every(tc => READ_ONLY_TOOLS.has(tc.name));
      if (allReadOnly && response.tool_calls.length > 1) {
        const results = await Promise.all(
          response.tool_calls.map(tc => this.handleToolCall(tc))
        );
        for (const result of results) {
          const hasError = !!result.error;
          this.messages.push({
            role: 'tool',
            content: truncateToolOutput(result.error || result.output),
            tool_call_id: result.tool_call_id,
          });
          if (hasError) {
            this.consecutiveFailures++;
            this.injectReflexion(result.error!, response.tool_calls.find(tc => tc.id === result.tool_call_id)?.name || 'unknown');
          } else {
            this.consecutiveFailures = 0;
          }
        }
      } else {
        for (const toolCall of response.tool_calls) {
          const result = await this.handleToolCall(toolCall);
          const hasError = !!result.error;
          this.messages.push({
            role: 'tool',
            content: truncateToolOutput(result.error || result.output),
            tool_call_id: result.tool_call_id,
          });
          if (hasError) {
            this.consecutiveFailures++;
            this.injectReflexion(result.error!, toolCall.name);
          } else {
            this.consecutiveFailures = 0;
          }
        }
      }
    }

    if (iterations >= this.maxIterations) {
      this.handler.showMessage(
        'system',
        `I'm out of gas for this turn (${this.maxIterations} steps used). Send another message to keep going, or hit Reset for a fresh start.`
      );
    }

    return finalResponse;
  }

  async runTask(task: string): Promise<string> {
    return this.processMessage(task);
  }

  completeRun(summary: string): void {
    if (this.logger) {
      this.logger.complete(summary);
    }
    this.saveExecutionTrace();
  }

  failRun(error: string): void {
    if (this.logger) {
      this.logger.fail(error);
    }
    this.saveExecutionTrace();
  }

  getExecutionTrace(): import('./execution-tracker').ExecutionTrace | null {
    return this.executionTracker?.getTrace() || null;
  }

  private saveExecutionTrace(): void {
    if (!this.executionTracker || !this.logger) return;
    const trace = this.executionTracker.getTrace();
    const tracePath = path.join(
      this.workspaceRoot, '.rivet', 'runs',
      `${this.logger.runId}.trace.json`
    );
    try {
      fs.writeFileSync(tracePath, JSON.stringify(trace, null, 2), 'utf-8');
    } catch { /* non-critical */ }
  }

  private async handleToolCall(call: ToolCall): Promise<{ tool_call_id: string; output: string; error?: string }> {
    if (call.name === 'delegate_task') {
      return this.executeDelegateTask(call);
    }

    if (call.name === 'semantic_search') {
      return this.executeSemanticSearch(call);
    }

    const action = this.buildProposedAction(call);

    if (this.logger) {
      this.logger.addAction({
        type: 'tool_call',
        data: { tool: call.name, args: call.arguments },
      });
    }

    if (this.dryRun) {
      this.handler.showToolResult(call.name, '[DRY RUN] Action would be executed');
      return { tool_call_id: call.id, output: '[DRY RUN] Action skipped' };
    }

    const needsApproval = requiresApproval(
      call.name,
      this.permissions,
      call.arguments.command as string | undefined
    );

    if (needsApproval && !this.shouldAutoApprove(action)) {
      let diff: string | undefined;
      if (call.name === 'write_file') {
        diff = this.computeDiff(call);
      } else if (call.name === 'str_replace') {
        diff = this.computeStrReplaceDiff(call);
      }

      const approved = await this.handler.requestApproval(action, diff);

      if (this.logger) {
        this.logger.addAction({
          type: 'approval_response',
          data: { approved, tool: call.name },
        });
      }

      if (!approved) {
        return { tool_call_id: call.id, output: '', error: 'Action denied by user' };
      }
    }

    if (this.untrustedContentDetected) {
      const scope = evaluateToolScope(call.name, call.arguments, true);
      if (scope.mode === 'approval_required' && !needsApproval) {
        const approved = await this.handler.requestApproval(
          { ...action, description: `${action.description} [Content Guard: untrusted content detected]` },
        );
        if (!approved) {
          return { tool_call_id: call.id, output: '', error: 'Action denied — untrusted content in context' };
        }
      }
    }

    const result = await executeTool(call, this.workspaceRoot, this.permissions);

    if (result.output) {
      const guardResult = scanToolOutput(result.output, call.name);
      if (!guardResult.safe) {
        this.untrustedContentDetected = true;
        const threatSummary = guardResult.threats.map(t => `${t.type}: "${t.match}"`).join('; ');
        this.handler.showMessage('system', `[Content Guard] Threats detected in ${call.name} output: ${threatSummary}`);
        result.output = sanitizeForContext(result.output, `tool:${call.name}`);
      }
    }

    this.executionTracker?.snapshot(this.messages, 'tool_result', call.name);

    this.handler.showToolResult(call.name, result.output, result.error);

    if (this.logger) {
      this.logger.addAction({
        type: 'tool_result',
        data: {
          tool: call.name,
          output: result.output,
          error: result.error,
        },
      });
    }

    const isWriteOp = call.name === 'write_file' || call.name === 'str_replace';
    if (isWriteOp && !result.error && this.buildCommand) {
      const buildResult = this.runBuildVerification();
      if (buildResult) {
        result.output += '\n\n[Build Check]\n' + buildResult;
      }
    }

    return result;
  }

  private buildProposedAction(call: ToolCall): ProposedAction {
    const riskMap: Record<string, 'low' | 'medium' | 'high'> = {
      list_dir: 'low',
      read_file: 'low',
      search_in_files: 'low',
      search_code: 'low',
      check_errors: 'low',
      git_status: 'low',
      git_diff: 'low',
      git_log: 'low',
      fetch_url: 'low',
      semantic_search: 'low',
      write_file: 'medium',
      str_replace: 'medium',
      git_commit: 'medium',
      delegate_task: 'medium',
      run_command: 'high',
    };

    return {
      tool: call.name,
      args: call.arguments,
      description: this.describeAction(call),
      risk: riskMap[call.name] || 'high',
      requires_approval: requiresApproval(
        call.name,
        this.permissions,
        call.arguments.command as string | undefined
      ),
    };
  }

  private describeAction(call: ToolCall): string {
    switch (call.name) {
      case 'list_dir':
        return `List directory: ${call.arguments.path}`;
      case 'read_file':
        return `Read file: ${call.arguments.path}`;
      case 'write_file':
        return `Write file: ${call.arguments.path}`;
      case 'str_replace':
        return `Edit file: ${call.arguments.path}`;
      case 'run_command':
        return `Execute command: ${call.arguments.command}`;
      case 'search_in_files':
        return `Search for: ${call.arguments.query}`;
      case 'search_code':
        return `Search code: ${call.arguments.query} (${call.arguments.mode || 'context'})`;
      case 'check_errors':
        return `Check errors${call.arguments.path ? ': ' + call.arguments.path : ''}`;
      case 'git_status':
        return 'Git status';
      case 'git_diff':
        return `Git diff${call.arguments.file ? ': ' + call.arguments.file : ''}`;
      case 'git_log':
        return `Git log (${call.arguments.count || 10} commits)`;
      case 'git_commit':
        return `Git commit: ${call.arguments.message}`;
      case 'delegate_task':
        return `Delegate sub-task: ${(call.arguments.task as string || '').slice(0, 80)}`;
      case 'semantic_search':
        return `Semantic search: ${call.arguments.query}`;
      default:
        return `${call.name}(${JSON.stringify(call.arguments)})`;
    }
  }

  private computeDiff(call: ToolCall): string {
    const filePath = call.arguments.path as string;
    const newContent = call.arguments.content as string;
    const fullPath = path.resolve(this.workspaceRoot, filePath);

    let oldContent = '';
    try {
      oldContent = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      oldContent = '';
    }

    return generateDiff(filePath, oldContent, newContent);
  }

  private computeStrReplaceDiff(call: ToolCall): string {
    const filePath = call.arguments.path as string;
    const oldStr = call.arguments.old_string as string;
    const newStr = call.arguments.new_string as string;
    const replaceAll = call.arguments.replace_all as boolean | undefined;
    const fullPath = path.resolve(this.workspaceRoot, filePath);

    let oldContent = '';
    try {
      oldContent = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      return '';
    }

    const newContent = replaceAll
      ? oldContent.split(oldStr).join(newStr)
      : oldContent.replace(oldStr, newStr);

    return generateDiff(filePath, oldContent, newContent);
  }

  private runBuildVerification(): string | null {
    if (!this.buildCommand) return null;
    try {
      execSync(this.buildCommand, {
        cwd: this.workspaceRoot,
        timeout: 60000,
        maxBuffer: 5 * 1024 * 1024,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return 'PASS';
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string };
      const output = ((execErr.stdout || '') + '\n' + (execErr.stderr || '')).trim();
      const lines = output.split('\n');
      const truncated = lines.length > 30 ? lines.slice(0, 30).join('\n') + '\n...' : output;
      return 'FAIL\n' + truncated;
    }
  }

  private detectWorkspaceContext(): string {
    const parts: string[] = [];
    const check = (file: string) => fs.existsSync(path.join(this.workspaceRoot, file));

    if (check('package.json')) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(this.workspaceRoot, 'package.json'), 'utf-8'));
        parts.push(`Node.js project: ${pkg.name || 'unknown'}`);
        if (pkg.dependencies?.next || pkg.dependencies?.['next']) parts.push('Framework: Next.js');
        else if (pkg.dependencies?.react) parts.push('Framework: React');
        else if (pkg.dependencies?.express) parts.push('Framework: Express');
        else if (pkg.dependencies?.vue) parts.push('Framework: Vue');
        if (check('pnpm-workspace.yaml') || pkg.workspaces) parts.push('Monorepo');
      } catch { /* skip */ }
    }
    if (check('Cargo.toml')) parts.push('Rust project');
    if (check('go.mod')) parts.push('Go project');
    if (check('pyproject.toml')) parts.push('Python project');
    if (check('pom.xml')) parts.push('Java (Maven) project');
    if (check('build.gradle')) parts.push('Java (Gradle) project');
    if (check('tsconfig.json')) parts.push('TypeScript enabled');
    if (check('.git')) parts.push('Git repo');
    if (check('Dockerfile') || check('docker-compose.yml')) parts.push('Docker');

    return parts.join('. ');
  }

  private async executeDelegateTask(call: ToolCall): Promise<{ tool_call_id: string; output: string; error?: string }> {
    if (!this.allowSubagent) {
      return { tool_call_id: call.id, output: '', error: 'Sub-agent delegation is disabled for this agent (prevents recursion)' };
    }

    const task = call.arguments.task as string;
    const context = (call.arguments.context as string) || '';

    if (!task) {
      return { tool_call_id: call.id, output: '', error: 'task argument is required' };
    }

    const action: ProposedAction = {
      tool: 'delegate_task',
      args: call.arguments,
      description: `Delegate sub-task: ${task.slice(0, 80)}`,
      risk: 'medium',
      requires_approval: true,
    };

    const approved = await this.handler.requestApproval(action);
    if (!approved) {
      return { tool_call_id: call.id, output: '', error: 'Action denied by user' };
    }

    this.handler.showMessage('system', `[Subagent] Starting: ${task.slice(0, 100)}`);

    const silentHandler: ApprovalHandler = {
      requestApproval: async () => this.autoApprove,
      showPlan: () => {},
      showMessage: (role, content) => {
        if (role === 'system') this.handler.showMessage('system', `[Subagent] ${content}`);
      },
      showToolResult: () => {},
    };

    const child = new AgentLoop({
      provider: this.provider,
      handler: silentHandler,
      workspaceRoot: this.workspaceRoot,
      dryRun: this.dryRun,
      autoApprove: this.autoApprove,
      maxIterations: 5,
      contextWindowTokens: this.contextWindowTokens,
      buildCommand: this.buildCommand,
      allowSubagent: false,
    });

    try {
      const prompt = context ? `Context: ${context}\n\nTask: ${task}` : task;
      const result = await child.processMessage(prompt);
      this.handler.showMessage('system', `[Subagent] Completed`);
      return { tool_call_id: call.id, output: result || 'Sub-task completed (no text response)' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { tool_call_id: call.id, output: '', error: `Sub-agent failed: ${msg}` };
    }
  }

  private shouldAutoApprove(action: ProposedAction): boolean {
    if (!this.autoApprove) return false;
    return action.risk === 'low';
  }

  private estimateTokens(): number {
    let chars = 0;
    for (const msg of this.messages) {
      chars += msg.content.length;
      if (msg.tool_calls) {
        chars += JSON.stringify(msg.tool_calls).length;
      }
    }
    return Math.ceil(chars / APPROX_CHARS_PER_TOKEN);
  }

  private pruneIfNeeded(): void {
    const limit = this.contextWindowTokens * (1 - TOKEN_LIMIT_RESERVE);
    if (this.estimateTokens() <= limit) return;

    const systemMsg = this.messages[0]?.role === 'system' ? this.messages[0] : null;
    const rest = systemMsg ? this.messages.slice(1) : [...this.messages];

    const oldMessages: Message[] = [];
    while (this.estimateTokens() > limit && rest.length > 4) {
      const removed = rest.shift()!;
      oldMessages.push(removed);
      if (removed.role === 'tool') {
        const next = rest.shift();
        if (next) oldMessages.push(next);
        continue;
      }
      this.messages = systemMsg ? [systemMsg, ...rest] : [...rest];
    }

    if (oldMessages.length > 0) {
      const summary = this.summarizeMessages(oldMessages);
      if (summary) {
        rest.unshift({ role: 'system', content: `[Conversation Summary]\n${summary}` });
      }
      if (!this.staminaWarned.has('memory-pruned')) {
        this.staminaWarned.add('memory-pruned');
        this.handler.showMessage('system', 'Memory getting full — I\'ve compressed our earlier conversation to make room. I still remember the key points.');
      }
    }

    this.messages = systemMsg ? [systemMsg, ...rest] : [...rest];
  }

  private summarizeMessages(messages: Message[]): string {
    const parts: string[] = [];
    let userQuestions: string[] = [];
    let toolsUsed: string[] = [];
    let keyResults: string[] = [];
    let errorsHit: string[] = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        const snippet = msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content;
        userQuestions.push(snippet);
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          toolsUsed.push(`${tc.name}(${this.summarizeArgs(tc.arguments)})`);
        }
      } else if (msg.role === 'tool') {
        const content = msg.content;
        if (content.length > 0) {
          if (content.startsWith('Error') || content.startsWith('FAIL') || content.includes('error')) {
            errorsHit.push(content.slice(0, 150));
          } else {
            const summary = content.length > 100 ? content.slice(0, 100) + '...' : content;
            keyResults.push(summary);
          }
        }
      } else if (msg.role === 'assistant' && msg.content) {
        const snippet = msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content;
        parts.push(`Assistant said: ${snippet}`);
      }
    }

    const sections: string[] = [];
    if (userQuestions.length > 0) sections.push(`User asked: ${userQuestions.join('; ')}`);
    if (toolsUsed.length > 0) sections.push(`Tools used: ${toolsUsed.join(', ')}`);
    if (keyResults.length > 0) sections.push(`Results: ${keyResults.slice(0, 5).join('; ')}`);
    if (errorsHit.length > 0) sections.push(`Errors encountered: ${errorsHit.join('; ')}`);
    if (parts.length > 0) sections.push(parts.join('. '));

    return sections.join('\n');
  }

  private summarizeArgs(args: Record<string, unknown>): string {
    const entries = Object.entries(args);
    if (entries.length === 0) return '';
    const first = entries[0];
    const val = String(first[1]);
    return val.length > 40 ? val.slice(0, 40) + '...' : val;
  }

  private async executeSemanticSearch(call: ToolCall): Promise<{ tool_call_id: string; output: string; error?: string }> {
    const query = call.arguments.query as string;
    const topK = (call.arguments.top_k as number) || 8;

    if (!query) {
      return { tool_call_id: call.id, output: '', error: 'query argument is required' };
    }

    if (!this.repoIndex.isIndexed()) {
      this.handler.showMessage('system', 'Indexing repository for semantic search...');
      const fileCount = await this.repoIndex.buildIndex();
      this.handler.showMessage('system', `Indexed ${fileCount} files.`);
    }

    const results = this.repoIndex.search(query, topK);

    if (results.length === 0) {
      this.handler.showToolResult('semantic_search', 'No relevant code found.');
      return { tool_call_id: call.id, output: 'No relevant code found for the query.' };
    }

    const formatted = results.map((r, i) =>
      `--- Result ${i + 1}: ${r.file} (lines ${r.startLine}-${r.endLine}) ---\n${r.content}`
    ).join('\n\n');

    this.handler.showToolResult('semantic_search', `Found ${results.length} relevant chunks.`);

    if (this.logger) {
      this.logger.addAction({
        type: 'tool_call',
        data: { tool: 'semantic_search', args: { query, top_k: topK } },
      });
      this.logger.addAction({
        type: 'tool_result',
        data: { tool: 'semantic_search', output: `${results.length} results` },
      });
    }

    return { tool_call_id: call.id, output: formatted };
  }

  private injectReflexion(error: string, toolName: string): void {
    if (this.consecutiveFailures < 2) return;

    const reflexionPrompt = [
      `[Reflexion — ${this.consecutiveFailures} consecutive failures]`,
      `The last tool (${toolName}) failed with: ${error.slice(0, 300)}`,
      `Before your next action, answer these questions internally:`,
      `1. What did I assume that turned out to be wrong?`,
      `2. Is there a different tool or approach that would work?`,
      `3. Do I need to read/check something before trying again?`,
      `Do NOT repeat the same action. Change your approach.`,
    ].join('\n');

    this.messages.push({
      role: 'system',
      content: reflexionPrompt,
    });

    if (this.handler.showMessage) {
      this.handler.showMessage('system', `[Reflexion] ${this.consecutiveFailures} consecutive failures — prompting self-critique.`);
    }
  }
}
