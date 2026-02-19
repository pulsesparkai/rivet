import * as fs from 'fs';
import * as path from 'path';
import {
  RunLog,
  RunAction,
  RIVET_DIR,
  RUNS_DIR,
  generateId,
  timestamp,
  redactSecrets,
} from '@pulsespark/shared';

export class RunLogger {
  private log: RunLog;
  private logPath: string;

  constructor(workspaceRoot: string, task: string, provider: string, model: string) {
    const ts = timestamp();
    const id = generateId();
    this.log = {
      id,
      timestamp: ts,
      task,
      provider,
      model,
      actions: [],
      status: 'running',
    };

    const runsDir = path.join(workspaceRoot, RIVET_DIR, RUNS_DIR);
    if (!fs.existsSync(runsDir)) {
      fs.mkdirSync(runsDir, { recursive: true });
    }

    const safeTs = ts.replace(/[:.]/g, '-');
    this.logPath = path.join(runsDir, `${safeTs}_${id}.json`);
    this.save();
  }

  get runId(): string {
    return this.log.id;
  }

  setPlan(plan: string): void {
    this.log.plan = redactSecrets(plan);
    this.save();
  }

  addAction(action: Omit<RunAction, 'timestamp'>): void {
    this.log.actions.push({
      ...action,
      timestamp: timestamp(),
      data: this.redactData(action.data),
    });
    this.save();
  }

  complete(summary: string): void {
    this.log.summary = redactSecrets(summary);
    this.log.status = 'completed';
    this.save();
  }

  fail(error: string): void {
    this.log.summary = redactSecrets(error);
    this.log.status = 'failed';
    this.save();
  }

  cancel(): void {
    this.log.status = 'cancelled';
    this.save();
  }

  getLog(): RunLog {
    return { ...this.log };
  }

  private redactData(data: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        redacted[key] = redactSecrets(value);
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactData(value as Record<string, unknown>);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  private save(): void {
    fs.writeFileSync(this.logPath, JSON.stringify(this.log, null, 2), 'utf-8');
  }

  static listRuns(workspaceRoot: string): RunLog[] {
    const runsDir = path.join(workspaceRoot, RIVET_DIR, RUNS_DIR);
    if (!fs.existsSync(runsDir)) return [];

    const files = fs.readdirSync(runsDir).filter((f) => f.endsWith('.json')).sort().reverse();

    return files.map((f) => {
      const raw = fs.readFileSync(path.join(runsDir, f), 'utf-8');
      return JSON.parse(raw) as RunLog;
    });
  }

  static getRunById(workspaceRoot: string, id: string): RunLog | null {
    const runs = RunLogger.listRuns(workspaceRoot);
    return runs.find((r) => r.id === id || r.id.startsWith(id)) || null;
  }
}
