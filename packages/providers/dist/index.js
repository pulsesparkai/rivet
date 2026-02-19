"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomHttpProvider = exports.AnthropicProvider = exports.OpenAICompatibleProvider = void 0;
exports.createProvider = createProvider;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const shared_1 = require("@pulsespark/shared");
const openai_compatible_1 = require("./openai-compatible");
const anthropic_1 = require("./anthropic");
const custom_http_1 = require("./custom-http");
var openai_compatible_2 = require("./openai-compatible");
Object.defineProperty(exports, "OpenAICompatibleProvider", { enumerable: true, get: function () { return openai_compatible_2.OpenAICompatibleProvider; } });
var anthropic_2 = require("./anthropic");
Object.defineProperty(exports, "AnthropicProvider", { enumerable: true, get: function () { return anthropic_2.AnthropicProvider; } });
var custom_http_2 = require("./custom-http");
Object.defineProperty(exports, "CustomHttpProvider", { enumerable: true, get: function () { return custom_http_2.CustomHttpProvider; } });
function createProvider(config, workspaceRoot) {
    switch (config.provider) {
        case 'openai_compatible':
            return new openai_compatible_1.OpenAICompatibleProvider({
                base_url: config.base_url || 'https://api.openai.com/v1',
                api_key_env: config.api_key_env || 'OPENAI_API_KEY',
                model: config.model,
            });
        case 'anthropic':
            return new anthropic_1.AnthropicProvider({
                api_key_env: config.api_key_env || 'ANTHROPIC_API_KEY',
                model: config.model,
            });
        case 'custom_http': {
            const customConfigPath = path.join(workspaceRoot, shared_1.RIVET_DIR, shared_1.CUSTOM_PROVIDER_FILE);
            if (!fs.existsSync(customConfigPath)) {
                throw new Error(`Custom provider config not found at ${customConfigPath}`);
            }
            const raw = fs.readFileSync(customConfigPath, 'utf-8');
            const customConfig = JSON.parse(raw);
            return new custom_http_1.CustomHttpProvider({ ...customConfig, model: config.model });
        }
        default:
            throw new Error(`Unknown provider: ${config.provider}`);
    }
}
function loadConfig(workspaceRoot) {
    const configPath = path.join(workspaceRoot, shared_1.RIVET_DIR, 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
}
function saveConfig(workspaceRoot, config) {
    const configPath = path.join(workspaceRoot, shared_1.RIVET_DIR, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}
