import { EventEmitter } from 'events';

export type AgentEventType =
  | 'message'
  | 'tool_call'
  | 'tool_result'
  | 'approval_request'
  | 'approval_response'
  | 'error'
  | 'run_start'
  | 'run_end'
  | 'status';

export interface AgentEvent {
  type: AgentEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export class AgentEventBus extends EventEmitter {
  publish(event: AgentEvent): void {
    this.emit('agent_event', event);
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.on('agent_event', listener);
    return () => this.off('agent_event', listener);
  }

  publishTyped(type: AgentEventType, data: Record<string, unknown>): void {
    this.publish({ type, timestamp: new Date().toISOString(), data });
  }
}

export const globalEventBus = new AgentEventBus();
