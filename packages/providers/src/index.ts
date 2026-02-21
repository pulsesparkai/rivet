import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { RivetConfig, RIVET_DIR, CUSTOM_PROVIDER_FILE } from '@pulsesparkai/shared';
import { ProviderAdapter } from './types';
import { OpenAICompatibleProvider } from './openai-compatible';
import { AnthropicProvider } from './anthropic';
import { CustomHttpProvider } from './custom-http';

export { OpenAICompatibleProvider } from './openai-compatible';
export { AnthropicProvider } from './anthropic';
export { CustomHttpProvider } from './custom-http';
export type { ProviderAdapter, ProviderRequest, StreamCallback, OpenAICompatibleConfig, AnthropicConfig, CustomHttpConfig } from './types';

function resolveSecretToEnv(envName: string, workspaceRoot: string): void {
  if (process.env[envName]) return;

  const secretsPath = path.join(workspaceRoot, RIVET_DIR, 'secrets.enc');
  if (!fs.existsSync(secretsPath)) return;

  try {
    const raw = fs.readFileSync(secretsPath);
    const salt = raw.subarray(0, 32);
    const cipherBundle = raw.subarray(32);
    if (cipherBundle.length === 0) return;

    const machineKey = [os.hostname(), os.userInfo().username, os.homedir()].join(':');
    const key = crypto.pbkdf2Sync(machineKey, salt, 100_000, 32, 'sha256');
    const iv = cipherBundle.subarray(0, 16);
    const authTag = cipherBundle.subarray(16, 32);
    const encrypted = cipherBundle.subarray(32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = decipher.update(encrypted) + decipher.final('utf-8');
    const secrets = JSON.parse(plaintext) as Record<string, string>;

    if (secrets[envName]) {
      process.env[envName] = secrets[envName];
    }
  } catch { /* secret store unavailable or corrupted — fall through */ }
}

export function createProvider(config: RivetConfig, workspaceRoot: string): ProviderAdapter {
  const keyEnv = config.api_key_env || (config.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY');
  resolveSecretToEnv(keyEnv, workspaceRoot);

  switch (config.provider) {
    case 'openai_compatible':
      return new OpenAICompatibleProvider({
        base_url: config.base_url || 'https://api.openai.com/v1',
        api_key_env: keyEnv,
        model: config.model,
      });

    case 'anthropic':
      return new AnthropicProvider({
        api_key_env: keyEnv,
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
