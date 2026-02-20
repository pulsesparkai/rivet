export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  tool_call_id: string;
  output: string;
  error?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface GenerateRequest {
  messages: Message[];
  tools?: ToolDefinition[];
  tool_mode?: 'auto' | 'required' | 'none';
}

export interface GenerateResponse {
  text: string;
  tool_calls?: ToolCall[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ProviderConfig {
  provider: 'openai_compatible' | 'anthropic' | 'custom_http';
  model: string;
  base_url?: string;
  api_key_env?: string;
}

export interface CustomProviderConfig {
  type: 'custom_http';
  url: string;
  headers: Record<string, string>;
  body_template: Record<string, unknown>;
  response_paths: {
    text: string;
    tool_calls?: string;
  };
}

export interface PermissionsConfig {
  workspace_root: string;
  allowed_paths: string[];
  run_command: boolean;
  write_file: boolean;
  require_approval_for_commands: boolean;
  require_diff_approval: boolean;
  allowlisted_commands: string[];
  deny_patterns: string[];
  network_access: boolean;
}

export interface RunLog {
  id: string;
  timestamp: string;
  task: string;
  provider: string;
  model: string;
  plan?: string;
  actions: RunAction[];
  summary?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  hasTrace?: boolean;
  contentGuardAlerts?: number;
}

export interface RunAction {
  type: 'tool_call' | 'approval_request' | 'approval_response' | 'tool_result';
  timestamp: string;
  data: Record<string, unknown>;
}

export interface ProposedAction {
  tool: string;
  args: Record<string, unknown>;
  description: string;
  risk: 'low' | 'medium' | 'high';
  requires_approval: boolean;
}

export interface Plan {
  steps: PlanStep[];
  summary: string;
}

export interface PlanStep {
  description: string;
  actions: ProposedAction[];
}

export interface RivetConfig {
  provider: string;
  model: string;
  base_url?: string;
  api_key_env?: string;
  build_command?: string;
  max_iterations?: number;
}

export interface MemoryEntry {
  key: string;
  value: string;
  timestamp: string;
}
