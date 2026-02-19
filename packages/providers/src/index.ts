import * as fs from 'fs';
import * as path from 'path';
import { RivetConfig, RIVET_DIR, CUSTOM_PROVIDER_FILE } from '@pulsespark/shared';
import { ProviderAdapter } from './types';
import { OpenAICompatibleProvider } from './openai-compatible';
import { AnthropicProvider } from './anthropic';
import { CustomHttpProvider } from './custom-http';

export { OpenAICompatibleProvider } from './openai-compatible';
export { AnthropicProvider } from './anthropic';
export { CustomHttpProvider } from './custom-http';
export type { ProviderAdapter, ProviderRequest, OpenAICompatibleConfig, AnthropicConfig, CustomHttpConfig } from './types';

export function createProvider(config: RivetConfig, workspaceRoot: string): ProviderAdapter {
  switch (config.provider) {
    case 'openai_compatible':
      return new OpenAICompatibleProvider({
        base_url: config.base_url || 'https://api.openai.com/v1',
        api_key_env: config.api_key_env || 'RIVET_API_KEY',
        model: config.model,
      });

    case 'anthropic':
      return new AnthropicProvider({
        api_key_env: config.api_key_env || 'RIVET_API_KEY',
        model: config.model,
      });

    case 'custom_http': {
      const customConfigPath = path.join(workspaceRoot, RIVET_DIR, CUSTOM_PROVIDER_FILE);
      if (!fs.existsSync(customConfigPath)) {
        throw new Error(`Custom provider config not found at ${customConfigPath}`);
      }
      const raw = fs.readFileSync(customConfigPath, 'utf-8');
      const customConfig = JSON.parse(raw);
      return new CustomHttpProvider({ ...customConfig, model: config.model });
    }

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export function loadConfig(workspaceRoot: string): RivetConfig {
  const configPath = path.join(workspaceRoot, RIVET_DIR, 'config.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw) as RivetConfig;

  if (process.env.RIVET_BASE_URL) {
    config.base_url = process.env.RIVET_BASE_URL;
  }

  if (process.env.RIVET_MODEL) {
    config.model = process.env.RIVET_MODEL;
  }

  if (process.env.RIVET_API_KEY) {
    config.api_key_env = 'RIVET_API_KEY';
  }

  return config;
}

export function saveConfig(workspaceRoot: string, config: RivetConfig): void {
  const configPath = path.join(workspaceRoot, RIVET_DIR, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}
