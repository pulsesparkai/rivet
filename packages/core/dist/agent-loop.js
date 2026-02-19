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
exports.AgentLoop = void 0;
const permissions_1 = require("./permissions");
const tools_1 = require("./tools");
const run_logger_1 = require("./run-logger");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const SYSTEM_PROMPT = `You are Rivet, an agentic AI assistant that runs locally in the user's terminal. You help users by planning tasks, proposing actions, and executing them after approval.

You have access to these tools:
- list_dir(path): List files and directories
- read_file(path): Read a file's contents
- write_file(path, content): Write content to a file (requires approval)
- run_command(command, cwd): Execute a shell command (requires approval)
- search_in_files(query, globs): Search for patterns in files

Always start by understanding the task, then create a plan, then execute step by step. For file modifications, show clear diffs. For commands, explain what each command does before proposing it.

Be concise and direct. Focus on completing the task efficiently and safely.`;
class AgentLoop {
    messages = [];
    provider;
    handler;
    workspaceRoot;
    permissions;
    logger = null;
    dryRun;
    autoApprove;
    maxIterations;
    constructor(opts) {
        this.provider = opts.provider;
        this.handler = opts.handler;
        this.workspaceRoot = opts.workspaceRoot;
        this.permissions = (0, permissions_1.loadPermissions)(opts.workspaceRoot);
        this.dryRun = opts.dryRun || false;
        this.autoApprove = opts.autoApprove || false;
        this.maxIterations = opts.maxIterations || 20;
        this.messages.push({
            role: 'system',
            content: SYSTEM_PROMPT,
        });
    }
    startRun(task, provider, model) {
        this.logger = new run_logger_1.RunLogger(this.workspaceRoot, task, provider, model);
    }
    async processMessage(userMessage) {
        this.messages.push({ role: 'user', content: userMessage });
        let iterations = 0;
        let finalResponse = '';
        while (iterations < this.maxIterations) {
            iterations++;
            const response = await this.provider.generate({
                messages: this.messages,
                tools: tools_1.TOOL_DEFINITIONS,
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
    async runTask(task) {
        return this.processMessage(task);
    }
    completeRun(summary) {
        if (this.logger) {
            this.logger.complete(summary);
        }
    }
    failRun(error) {
        if (this.logger) {
            this.logger.fail(error);
        }
    }
    async handleToolCall(call) {
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
        const needsApproval = (0, permissions_1.requiresApproval)(call.name, this.permissions, call.arguments.command);
        if (needsApproval && !this.shouldAutoApprove(action)) {
            let diff;
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
        const result = (0, tools_1.executeTool)(call, this.workspaceRoot, this.permissions);
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
    buildProposedAction(call) {
        const riskMap = {
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
            requires_approval: (0, permissions_1.requiresApproval)(call.name, this.permissions, call.arguments.command),
        };
    }
    describeAction(call) {
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
    computeDiff(call) {
        const filePath = call.arguments.path;
        const newContent = call.arguments.content;
        const fullPath = path.resolve(this.workspaceRoot, filePath);
        let oldContent = '';
        try {
            oldContent = fs.readFileSync(fullPath, 'utf-8');
        }
        catch {
            oldContent = '';
        }
        return (0, tools_1.generateDiff)(filePath, oldContent, newContent);
    }
    shouldAutoApprove(action) {
        if (!this.autoApprove)
            return false;
        return action.risk === 'low';
    }
}
exports.AgentLoop = AgentLoop;
