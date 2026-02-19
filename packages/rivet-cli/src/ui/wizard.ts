import * as readline from 'readline';
import { initRivet, isInitialized } from '@pulsesparkai/core';
import { saveConfig } from '@pulsesparkai/providers';
import {
  PROVIDER_PRESETS,
  SAFETY_SCREEN,
  RivetConfig,
} from '@pulsesparkai/shared';
import { theme, divider } from './theme';

function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

export function looksLikeLiteralKey(value: string): boolean {
  return (
    value.startsWith('sk-') ||
    value.startsWith('sk-ant-') ||
    (value.length > 40 && /^[a-zA-Z0-9+/\-_]{30,}$/.test(value))
  );
}

export async function runOnboardingWizard(cwd: string): Promise<RivetConfig> {
  console.log(SAFETY_SCREEN);
  await waitForEnter();

  if (!isInitialized(cwd)) {
    initRivet(cwd);
  }

  console.log('');
  console.log(theme.brandBold('  Pick a brain'));
  console.log(divider());
  console.log('');

  for (let i = 0; i < PROVIDER_PRESETS.length; i++) {
    const p = PROVIDER_PRESETS[i];
    const num = theme.highlight(`${i + 1}`);
    console.log(`  ${num}. ${p.label}`);
  }
  console.log('');

  const providerAnswer = await ask(theme.brand('  Which provider? (enter number) '));
  const providerIdx = parseInt(providerAnswer, 10) - 1;
  const preset = PROVIDER_PRESETS[providerIdx] || PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1];

  if (preset.provider === 'demo') {
    const config: RivetConfig = {
      provider: 'demo',
      model: 'none',
      api_key_env: '',
    };
    saveConfig(cwd, config);
    console.log('');
    console.log(theme.warning('  DEMO MODE enabled. No LLM calls will be made.'));
    console.log(theme.dim('  You can explore Rivet safely. Configure a provider later with `rivet config`.'));
    console.log('');
    return config;
  }

  let config: RivetConfig;

  if (preset.label === 'Custom OpenAI-compatible') {
    const baseUrl = await ask(theme.brand('  Base URL: '));
    const model = await ask(theme.brand('  Model name: '));
    const keyEnv = await ask(theme.brand('  API key env var name: '));

    if (looksLikeLiteralKey(keyEnv)) {
      console.log(theme.error('  That looks like a literal API key. Use an env var name (e.g. MY_API_KEY).'));
      process.exit(1);
    }

    config = {
      provider: 'openai_compatible',
      model: model || 'gpt-4.1-mini',
      base_url: baseUrl,
      api_key_env: keyEnv,
    };
  } else {
    const modelAnswer = await ask(
      theme.brand(`  Model [${preset.default_model}]: `)
    );
    const model = modelAnswer || preset.default_model;

    config = {
      provider: preset.provider,
      model,
      api_key_env: preset.api_key_env,
    };

    if (preset.base_url) {
      config.base_url = preset.base_url;
    }
  }

  if (config.api_key_env) {
    console.log('');
    console.log(theme.bold('  Key setup'));
    console.log(divider());
    console.log(theme.dim('  Rivet never stores raw keys. Set an environment variable:'));
    console.log('');
    console.log(`    ${theme.highlight(`export ${config.api_key_env}=<your-key>`)}`);
    console.log('');
    if (preset.note) {
      console.log(theme.dim(`  Note: ${preset.note}`));
      console.log('');
    }
    console.log(theme.dim('  Add it to your shell profile (~/.bashrc, ~/.zshrc) to persist.'));
  }

  console.log('');
  console.log(theme.bold('  Permissions'));
  console.log(divider());
  console.log(theme.dim('  Rivet starts READ-ONLY by default.'));
  console.log(theme.dim('  Writes and shell commands require your approval every time.'));
  console.log(theme.dim('  You can change this later in .rivet/permissions.json.'));
  console.log('');

  saveConfig(cwd, config);

  console.log(theme.success('  Configuration saved to .rivet/config.json'));
  console.log('');

  return config;
}

export function needsOnboarding(cwd: string): boolean {
  if (!isInitialized(cwd)) return true;

  try {
    const fs = require('fs');
    const path = require('path');
    const raw = fs.readFileSync(path.join(cwd, '.rivet', 'config.json'), 'utf-8');
    const config = JSON.parse(raw) as RivetConfig;

    if (!config.provider || !config.model) return true;
    if (config.provider === 'demo') return false;

    if (config.api_key_env) {
      const keyValue = process.env[config.api_key_env];
      if (!keyValue) return true;
    }

    return false;
  } catch {
    return true;
  }
}

export function isDemoMode(config: RivetConfig): boolean {
  return config.provider === 'demo';
}
