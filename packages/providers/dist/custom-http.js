"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomHttpProvider = void 0;
const shared_1 = require("@pulsespark/shared");
class CustomHttpProvider {
    name = 'custom_http';
    config;
    constructor(config) {
        this.config = config;
    }
    async generate(request) {
        const url = (0, shared_1.interpolateEnvVars)(this.config.url);
        const headers = { 'Content-Type': 'application/json' };
        for (const [key, value] of Object.entries(this.config.headers)) {
            headers[key] = (0, shared_1.interpolateEnvVars)(value);
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
        const data = (await response.json());
        return this.parseResponse(data);
    }
    buildBody(request) {
        const result = {};
        for (const [key, value] of Object.entries(this.config.body_template)) {
            if (typeof value === 'string') {
                if (value === '${MODEL}') {
                    result[key] = this.config.model;
                }
                else if (value === '${MESSAGES_JSON}') {
                    result[key] = request.messages;
                }
                else if (value === '${TOOLS_JSON}') {
                    result[key] = request.tools || [];
                }
                else {
                    result[key] = (0, shared_1.interpolateEnvVars)(value);
                }
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
    parseResponse(data) {
        const textPath = this.config.response_paths.text;
        const text = (0, shared_1.getNestedValue)(data, textPath) || '';
        let toolCalls;
        if (this.config.response_paths.tool_calls) {
            const rawCalls = (0, shared_1.getNestedValue)(data, this.config.response_paths.tool_calls);
            if (Array.isArray(rawCalls)) {
                toolCalls = rawCalls.map((rc) => ({
                    id: rc.id || (0, shared_1.generateId)(),
                    name: rc.name,
                    arguments: (rc.arguments || rc.input || {}),
                }));
            }
        }
        return { text, tool_calls: toolCalls };
    }
}
exports.CustomHttpProvider = CustomHttpProvider;
