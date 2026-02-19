import { GenerateResponse, ToolCall, generateId } from '@pulsespark/shared';
import { ProviderAdapter, ProviderRequest, AnthropicConfig } from './types';

export class AnthropicProvider implements ProviderAdapter {
  name = 'anthropic';
  private config: AnthropicConfig;

  constructor(config: AnthropicConfig) {
    this.config = config;
  }

  async generate(request: ProviderRequest): Promise<GenerateResponse> {
    const apiKey = process.env[this.config.api_key_env];
    if (!apiKey) {
      throw new Error(`Environment variable ${this.config.api_key_env} is not set`);
    }

    const systemMessage = request.messages.find((m) => m.role === 'system');
    const conversationMessages = request.messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: 4096,
      messages: conversationMessages.map((m) => this.formatMessage(m)),
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      content: Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;
    };

    let text = '';
    const toolCalls: ToolCall[] = [];

    for (const block of data.content) {
      if (block.type === 'text' && block.text) {
        text += block.text;
      } else if (block.type === 'tool_use' && block.name && block.input) {
        toolCalls.push({
          id: block.id || generateId(),
          name: block.name,
          arguments: block.input,
        });
      }
    }

    return { text, tool_calls: toolCalls.length > 0 ? toolCalls : undefined };
  }

  private formatMessage(msg: { role: string; content: string; tool_calls?: ToolCall[]; tool_call_id?: string }) {
    if (msg.role === 'tool') {
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.tool_call_id,
            content: msg.content,
          },
        ],
      };
    }

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const content: unknown[] = [];
      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }
      for (const tc of msg.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        });
      }
      return { role: 'assistant', content };
    }

    return { role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content };
  }
}
