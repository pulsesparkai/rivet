import { Message, ToolDefinition, GenerateResponse } from '@pulsesparkai/shared';

export type StreamCallback = (chunk: string) => void;

export interface ProviderAdapter {
  name: string;
  generate(request: ProviderRequest): Promise<GenerateResponse>;
  generateStream?(request: ProviderRequest, onToken: StreamCallback): Promise<GenerateResponse>;
}

export interface ProviderRequest {
  messages: Message[];
  tools?: ToolDefinition[];
  tool_mode?: string;
}

export interface OpenAICompatibleConfig {
  base_url: string;
  api_key_env: string;
  model: string;
}

export interface AnthropicConfig {
  api_key_env: string;
  model: string;
}

export interface CustomHttpConfig {
  url: string;
  headers: Record<string, string>;
  body_template: Record<string, unknown>;
  response_paths: {
    text: string;
    tool_calls?: string;
  };
  model: string;
}
