import { Message, GenerateResponse, ProposedAction } from '@pulsespark/shared';
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
export declare class AgentLoop {
    private messages;
    private provider;
    private handler;
    private workspaceRoot;
    private permissions;
    private logger;
    private dryRun;
    private autoApprove;
    private maxIterations;
    constructor(opts: {
        provider: Provider;
        handler: ApprovalHandler;
        workspaceRoot: string;
        dryRun?: boolean;
        autoApprove?: boolean;
        maxIterations?: number;
    });
    startRun(task: string, provider: string, model: string): void;
    processMessage(userMessage: string): Promise<string>;
    runTask(task: string): Promise<string>;
    completeRun(summary: string): void;
    failRun(error: string): void;
    private handleToolCall;
    private buildProposedAction;
    private describeAction;
    private computeDiff;
    private shouldAutoApprove;
}
