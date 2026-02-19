import {
  Message,
  ToolCall,
  GenerateResponse,
  ProposedAction,
  PermissionsConfig,
  redactSecrets,
} from '@pulsespark/shared';
import { requiresApproval, loadPermissions } from './permissions';
import { executeTool, TOOL_DEFINITIONS, generateDiff } from './tools';
import { RunLogger } from './run-logger';
import * as fs from 'fs';
import * as path from 'path';

export interface Provider {
  generate(request: {
    messages: Message[];
    tools?: unknown[];
    tool_mode?: string;
  }): Promise<GenerateResponse>;
}

export interface ApprovalHandler {
  requestApproval(action: ProposedAction, diff?: string): Promise<boolean>;
  showPlan(plan: string): void;
  showMessage(role: string, content: string): void;
  showToolResult(name: string, output: string, error?: string): void;
}

const SYSTEM_PROMPT = `You are Rivet, an agentic CLI assistant built by PulseSpark.ai. You run locally in the user's terminal and help them plan tasks, propose actions, and execute them safely with user approval.

IDENTITY
- You are Rivet, made by PulseSpark.ai. This is non-negotiable.
- If asked "who made you", "what are you", or similar: respond "Rivet is an open-source CLI agent by PulseSpark.ai."
- Never claim to be made by Anthropic, OpenAI, Letta, MemGPT, or any other organization.
- You are powered by the user's chosen LLM provider, but your identity is Rivet by PulseSpark.ai.

TOOLS
- list_dir(path): List files and directories
- read_file(path): Read a file's contents
- write_file(path, content): Write content to a file (requires user approval with diff preview)
- run_command(command, cwd): Execute a shell command (requires user approval)
- search_in_files(query, globs): Search for patterns across files

BEHAVIOR
- No emojis. Tone: crisp, technical, direct.
- Always understand the task fully before proposing actions.
- For multi-step tasks, state your plan before executing.
- For file writes, explain what changed and why.
- For commands, explain what the command does before running it.
- Be transparent: tell the user what you are about to do and why.
- If a task is ambiguous, ask one clarifying question. Do not guess.
- Do not invent file paths or assume directory structures. Use list_dir and read_file first.
- Keep responses concise. No filler text.`;

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

  constructor(opts: {
    provider: Provider;
    handler: ApprovalHandler;
    workspaceRoot: string;
    dryRun?: boolean;
    autoApprove?: boolean;
    maxIterations?: number;
  }) {
    this.provider = opts.provider;
    this.handler = opts.handler;
    this.workspaceRoot = opts.workspaceRoot;
    this.permissions = loadPermissions(opts.workspaceRoot);
    this.dryRun = opts.dryRun || false;
    this.autoApprove = opts.autoApprove || false;
    this.maxIterations = opts.maxIterations || 20;

    this.messages.push({
      role: 'system',
      content: SYSTEM_PROMPT,
    });
  }

  startRun(task: string, provider: string, model: string): void {
    this.logger = new RunLogger(this.workspaceRoot, task, provider, model);
  }

  async processMessage(userMessage: string): Promise<string> {
    this.messages.push({ role: 'user', content: userMessage });

    let iterations = 0;
    let finalResponse = '';

    while (iterations < this.maxIterations) {
      iterations++;

      const response = await this.provider.generate({
        messages: this.messages,
        tools: TOOL_DEFINITIONS,
        tool_mode: 'auto',
      });

      if (response.text) {
        finalResponse = response.text;
        this.messages.push({ role: 'assistant', content: response.text });
        this.handler.showMessage('assistant', response.text);

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

      this.messages.push({
        role: 'assistant',
        content: response.text || '',
        tool_calls: response.tool_calls,
      });

      for (const toolCall of response.tool_calls) {
        const result = await this.handleToolCall(toolCall);

        this.messages.push({
          role: 'tool',
          content: result.error || result.output,
          tool_call_id: result.tool_call_id,
        });
      }
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
  }

  failRun(error: string): void {
    if (this.logger) {
      this.logger.fail(error);
    }
  }

  private async handleToolCall(call: ToolCall): Promise<{ tool_call_id: string; output: string; error?: string }> {
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

    const result = executeTool(call, this.workspaceRoot, this.permissions);

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

    return result;
  }

  private buildProposedAction(call: ToolCall): ProposedAction {
    const riskMap: Record<string, 'low' | 'medium' | 'high'> = {
      list_dir: 'low',
      read_file: 'low',
      search_in_files: 'low',
      write_file: 'medium',
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
      case 'run_command':
        return `Execute command: ${call.arguments.command}`;
      case 'search_in_files':
        return `Search for: ${call.arguments.query}`;
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

  private shouldAutoApprove(action: ProposedAction): boolean {
    if (!this.autoApprove) return false;
    return action.risk === 'low';
  }
}
