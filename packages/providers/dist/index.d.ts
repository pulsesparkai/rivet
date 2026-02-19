import { RivetConfig } from '@pulsespark/shared';
import { ProviderAdapter } from './types';
export { OpenAICompatibleProvider } from './openai-compatible';
export { AnthropicProvider } from './anthropic';
export { CustomHttpProvider } from './custom-http';
export type { ProviderAdapter, ProviderRequest, OpenAICompatibleConfig, AnthropicConfig, CustomHttpConfig } from './types';
export declare function createProvider(config: RivetConfig, workspaceRoot: string): ProviderAdapter;
export declare function loadConfig(workspaceRoot: string): RivetConfig;
export declare function saveConfig(workspaceRoot: string, config: RivetConfig): void;
