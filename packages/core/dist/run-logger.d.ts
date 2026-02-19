import { RunLog, RunAction } from '@pulsespark/shared';
export declare class RunLogger {
    private log;
    private logPath;
    constructor(workspaceRoot: string, task: string, provider: string, model: string);
    get runId(): string;
    setPlan(plan: string): void;
    addAction(action: Omit<RunAction, 'timestamp'>): void;
    complete(summary: string): void;
    fail(error: string): void;
    cancel(): void;
    getLog(): RunLog;
    private redactData;
    private save;
    static listRuns(workspaceRoot: string): RunLog[];
    static getRunById(workspaceRoot: string, id: string): RunLog | null;
}
