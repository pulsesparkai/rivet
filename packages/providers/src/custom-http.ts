import { GenerateResponse, ToolCall, generateId, interpolateEnvVars, getNestedValue } from '@pulsespark/shared';
import { ProviderAdapter, ProviderRequest, CustomHttpConfig } from './types';

export class CustomHttpProvider implements ProviderAdapter {
  name = 'custom_http';
  private config: CustomHttpConfig;

  constructor(config: CustomHttpConfig) {
    this.config = config;
  }

  async generate(request: ProviderRequest): Promise<GenerateResponse> {
    const url = interpolateEnvVars(this.config.url);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    for (const [key, value] of Object.entries(this.config.headers)) {
      headers[key] = interpolateEnvVars(value);
    }

    const body = this.buildBody(request);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Custom HTTP provider error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.parseResponse(data);
  }

  private buildBody(request: ProviderRequest): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(this.config.body_template)) {
      if (typeof value === 'string') {
        if (value === '${MODEL}') {
          result[key] = this.config.model;
        } else if (value === '${MESSAGES_JSON}') {
          result[key] = request.messages;
        } else if (value === '${TOOLS_JSON}') {
          result[key] = request.tools || [];
        } else {
          result[key] = interpolateEnvVars(value);
        }
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private parseResponse(data: Record<string, unknown>): GenerateResponse {
    const textPath = this.config.response_paths.text;
    const text = (getNestedValue(data, textPath) as string) || '';

    let toolCalls: ToolCall[] | undefined;

    if (this.config.response_paths.tool_calls) {
      const rawCalls = getNestedValue(data, this.config.response_paths.tool_calls);
      if (Array.isArray(rawCalls)) {
        toolCalls = rawCalls.map((rc: Record<string, unknown>) => ({
          id: (rc.id as string) || generateId(),
          name: rc.name as string,
          arguments: (rc.arguments || rc.input || {}) as Record<string, unknown>,
        }));
      }
    }

    return { text, tool_calls: toolCalls };
  }
}
