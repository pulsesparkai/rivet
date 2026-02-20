import { GenerateResponse, ToolCall, generateId } from '@pulsesparkai/shared';
import { ProviderAdapter, ProviderRequest, OpenAICompatibleConfig, StreamCallback } from './types';

export class OpenAICompatibleProvider implements ProviderAdapter {
  name = 'openai_compatible';
  private config: OpenAICompatibleConfig;

  constructor(config: OpenAICompatibleConfig) {
    this.config = config;
  }

  async generate(request: ProviderRequest): Promise<GenerateResponse> {
    const apiKey = process.env[this.config.api_key_env];
    if (!apiKey) {
      throw new Error(`Environment variable ${this.config.api_key_env} is not set`);
    }

    const url = `${this.config.base_url.replace(/\/$/, '')}/chat/completions`;

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: request.messages.map((m) => this.formatMessage(m)),
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));

      if (request.tool_mode === 'required') {
        body.tool_choice = 'required';
      } else if (request.tool_mode === 'none') {
        body.tool_choice = 'none';
      } else {
        body.tool_choice = 'auto';
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    const choice = data.choices[0];
    const text = choice.message.content || '';
    const toolCalls: ToolCall[] = [];

    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        try {
          toolCalls.push({
            id: tc.id || generateId(),
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          });
        } catch {
          continue;
        }
      }
    }

    return { text, tool_calls: toolCalls.length > 0 ? toolCalls : undefined };
  }

  async generateStream(request: ProviderRequest, onToken: StreamCallback): Promise<GenerateResponse> {
    const apiKey = process.env[this.config.api_key_env];
    if (!apiKey) {
      throw new Error(`Environment variable ${this.config.api_key_env} is not set`);
    }

    const url = `${this.config.base_url.replace(/\/$/, '')}/chat/completions`;
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: request.messages.map((m) => this.formatMessage(m)),
      stream: true,
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      body.tool_choice = request.tool_mode === 'required' ? 'required' :
                         request.tool_mode === 'none' ? 'none' : 'auto';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    let fullText = '';
    const toolCallParts: Record<number, { id: string; name: string; args: string }> = {};

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            fullText += delta.content;
            onToken(delta.content);
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallParts[idx]) {
                toolCallParts[idx] = { id: tc.id || generateId(), name: '', args: '' };
              }
              if (tc.function?.name) toolCallParts[idx].name = tc.function.name;
              if (tc.function?.arguments) toolCallParts[idx].args += tc.function.arguments;
            }
          }
        } catch {
          continue;
        }
      }
    }

    const toolCalls: ToolCall[] = [];
    for (const part of Object.values(toolCallParts)) {
      try {
        toolCalls.push({ id: part.id, name: part.name, arguments: JSON.parse(part.args) });
      } catch { continue; }
    }

    return { text: fullText, tool_calls: toolCalls.length > 0 ? toolCalls : undefined };
  }

  private formatMessage(msg: { role: string; content: string; tool_calls?: ToolCall[]; tool_call_id?: string }) {
    const formatted: Record<string, unknown> = {
      role: msg.role,
      content: msg.content,
    };

    if (msg.tool_calls) {
      formatted.tool_calls = msg.tool_calls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      }));
    }

    if (msg.tool_call_id) {
      formatted.tool_call_id = msg.tool_call_id;
    }

    return formatted;
  }
}
