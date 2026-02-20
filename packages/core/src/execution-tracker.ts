import * as crypto from 'crypto';
import { Message, ToolCall, RunAction } from '@pulsesparkai/shared';

export interface StateSnapshot {
  step: number;
  fingerprint: string;
  timestamp: string;
  trigger: 'user_message' | 'tool_call' | 'tool_result' | 'assistant_response';
  toolName?: string;
  messageCount: number;
  tokenEstimate: number;
  data?: Record<string, unknown>;
}

export interface ExecutionTrace {
  runId: string;
  startedAt: string;
  provider: string;
  model: string;
  snapshots: StateSnapshot[];
  finalFingerprint: string;
}

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex').slice(0, 16);
}

function fingerprintMessages(messages: Message[]): string {
  const canonical = messages.map(m => {
    const parts = [m.role, m.content];
    if (m.tool_calls) parts.push(JSON.stringify(m.tool_calls));
    if (m.tool_call_id) parts.push(m.tool_call_id);
    return parts.join('|');
  }).join('\n');
  return hashContent(canonical);
}

export class ExecutionTracker {
  private snapshots: StateSnapshot[] = [];
  private step = 0;
  private runId: string;
  private provider: string;
  private model: string;
  private startedAt: string;

  constructor(runId: string, provider: string, model: string) {
    this.runId = runId;
    this.provider = provider;
    this.model = model;
    this.startedAt = new Date().toISOString();
  }

  snapshot(
    messages: Message[],
    trigger: StateSnapshot['trigger'],
    toolName?: string,
    data?: Record<string, unknown>
  ): StateSnapshot {
    this.step++;
    const fingerprint = fingerprintMessages(messages);
    const tokenEstimate = Math.ceil(
      messages.reduce((acc, m) => acc + m.content.length + (m.tool_calls ? JSON.stringify(m.tool_calls).length : 0), 0) / 4
    );

    const snap: StateSnapshot = {
      step: this.step,
      fingerprint,
      timestamp: new Date().toISOString(),
      trigger,
      toolName,
      messageCount: messages.length,
      tokenEstimate,
      data,
    };

    this.snapshots.push(snap);
    return snap;
  }

  getTrace(): ExecutionTrace {
    return {
      runId: this.runId,
      startedAt: this.startedAt,
      provider: this.provider,
      model: this.model,
      snapshots: [...this.snapshots],
      finalFingerprint: this.snapshots.length > 0
        ? this.snapshots[this.snapshots.length - 1].fingerprint
        : '',
    };
  }

  getSnapshots(): StateSnapshot[] {
    return [...this.snapshots];
  }

  static isReplayDeterministic(trace1: ExecutionTrace, trace2: ExecutionTrace): {
    deterministic: boolean;
    divergedAtStep: number | null;
    details: string;
  } {
    const minLen = Math.min(trace1.snapshots.length, trace2.snapshots.length);

    for (let i = 0; i < minLen; i++) {
      const s1 = trace1.snapshots[i];
      const s2 = trace2.snapshots[i];

      if (s1.fingerprint !== s2.fingerprint) {
        return {
          deterministic: false,
          divergedAtStep: i + 1,
          details: `State diverged at step ${i + 1} (${s1.trigger}${s1.toolName ? ': ' + s1.toolName : ''})`,
        };
      }
    }

    if (trace1.snapshots.length !== trace2.snapshots.length) {
      return {
        deterministic: false,
        divergedAtStep: minLen + 1,
        details: `Traces have different lengths (${trace1.snapshots.length} vs ${trace2.snapshots.length})`,
      };
    }

    return { deterministic: true, divergedAtStep: null, details: 'Traces are identical' };
  }
}
