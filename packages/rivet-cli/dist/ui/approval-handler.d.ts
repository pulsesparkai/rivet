import { ProposedAction } from '@pulsespark/shared';
import { ApprovalHandler } from '@pulsespark/core';
export declare class TerminalApprovalHandler implements ApprovalHandler {
    requestApproval(action: ProposedAction, diff?: string): Promise<boolean>;
    showPlan(plan: string): void;
    showMessage(role: string, content: string): void;
    showToolResult(name: string, output: string, error?: string): void;
}
