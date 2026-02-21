import * as http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { AgentLoop } from '@pulsesparkai/core';
import type { ApprovalHandler, Provider } from '@pulsesparkai/core';
import { createProvider, loadConfig } from '@pulsesparkai/providers';
import { loadSoulSafe } from '@pulsesparkai/core';
import type { ProposedAction } from '@pulsesparkai/shared';
import { generateId } from '@pulsesparkai/shared';

class WebApprovalHandler implements ApprovalHandler {
  private ws: WebSocket;
  private pendingApprovals = new Map<string, (approved: boolean) => void>();

  constructor(ws: WebSocket) {
    this.ws = ws;
  }

  requestApproval(action: ProposedAction, diff?: string): Promise<boolean> {
    return new Promise((resolve) => {
      const id = generateId();
      this.pendingApprovals.set(id, resolve);
      this.send({
        type: 'approval_request',
        id,
        action,
        diff,
      });
    });
  }

  resolveApproval(id: string, approved: boolean): void {
    const resolve = this.pendingApprovals.get(id);
    if (resolve) {
      this.pendingApprovals.delete(id);
      resolve(approved);
    }
  }

  showPlan(plan: string): void {
    this.send({ type: 'plan', content: plan });
  }

  showMessage(role: string, content: string): void {
    this.send({ type: 'message', role, content });
  }

  showToolStart(name: string, description: string): void {
    this.send({ type: 'tool_start', name, description });
  }

  showToolResult(name: string, output: string, error?: string): void {
    this.send({ type: 'tool_result', name, output, error });
  }

  streamToken(token: string): void {
    this.send({ type: 'stream_token', token });
  }

  streamEnd(): void {
    this.send({ type: 'stream_end' });
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

export function handleUpgrade(server: http.Server, workspaceRoot: string): void {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    let agent: AgentLoop | null = null;
    let handler: WebApprovalHandler | null = null;
    let provider: Provider | null = null;

    ws.on('message', async (raw: WebSocket.Data) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'chat') {
          if (!agent) {
            const config = loadConfig(workspaceRoot);
            provider = createProvider(config, workspaceRoot) as unknown as Provider;
            handler = new WebApprovalHandler(ws);
            const soulData = loadSoulSafe(workspaceRoot);

            agent = new AgentLoop({
              provider,
              handler,
              workspaceRoot,
              soulContext: soulData?.content || undefined,
              buildCommand: config.build_command,
              maxIterations: config.max_iterations,
            });
            agent.startRun(msg.message, config.provider, config.model);
          }

          handler!.showMessage('user', msg.message);

          try {
            const response = await agent.processMessage(msg.message);
            agent.completeRun(response || 'Completed');
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            handler!.showMessage('system', `Error: ${errMsg}`);
            agent.failRun(errMsg);
          }

          send(ws, { type: 'done' });
        }

        if (msg.type === 'approval_response' && handler) {
          handler.resolveApproval(msg.id, msg.approved);
        }

        if (msg.type === 'reset') {
          agent = null;
          handler = null;
          provider = null;
          send(ws, { type: 'reset_ack' });
        }
      } catch (err) {
        send(ws, {
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });

    ws.on('close', () => {
      agent = null;
      handler = null;
    });

    send(ws, { type: 'connected', workspace: workspaceRoot });
  });
}

function send(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}
