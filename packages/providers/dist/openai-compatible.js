"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAICompatibleProvider = void 0;
const shared_1 = require("@pulsespark/shared");
class OpenAICompatibleProvider {
    name = 'openai_compatible';
    config;
    constructor(config) {
        this.config = config;
    }
    async generate(request) {
        const apiKey = process.env[this.config.api_key_env];
        if (!apiKey) {
            throw new Error(`Environment variable ${this.config.api_key_env} is not set`);
        }
        const url = `${this.config.base_url.replace(/\/$/, '')}/chat/completions`;
        const body = {
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
            }
            else if (request.tool_mode === 'none') {
                body.tool_choice = 'none';
            }
            else {
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
        const data = (await response.json());
        const choice = data.choices[0];
        const text = choice.message.content || '';
        const toolCalls = [];
        if (choice.message.tool_calls) {
            for (const tc of choice.message.tool_calls) {
                try {
                    toolCalls.push({
                        id: tc.id || (0, shared_1.generateId)(),
                        name: tc.function.name,
                        arguments: JSON.parse(tc.function.arguments),
                    });
                }
                catch {
                    continue;
                }
            }
        }
        return { text, tool_calls: toolCalls.length > 0 ? toolCalls : undefined };
    }
    formatMessage(msg) {
        const formatted = {
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
exports.OpenAICompatibleProvider = OpenAICompatibleProvider;
