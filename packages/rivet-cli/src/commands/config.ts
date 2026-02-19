import { Command } from 'commander';
import * as readline from 'readline';
import { isInitialized, initRivet, loadPermissions } from '@pulsesparkai/core';
import { loadConfig, saveConfig } from '@pulsesparkai/providers';
import { PROVIDER_PRESETS } from '@pulsesparkai/shared';
import { theme, bootScreen, statusBar, divider } from '../ui/theme';
import { looksLikeLiteralKey } from '../ui/wizard';
import type { RivetConfig } from '@pulsesparkai/shared';
import type { BootContext } from '../ui/theme';

export const configCommand = new Command('config')
  .description('View and update provider configuration')
  .option('--set <key=value>', 'Set a config value (e.g. --set model=gpt-4)')
  .action(async (opts) => {
    const cwd = process.env.INIT_CWD ?? process.cwd();

    if (!isInitialized(cwd)) {
      console.log(theme.dim('  No .rivet/ found. Running first-time setup...'));
      console.log('');
      initRivet(cwd);
    }

    let configMissing = false;
    let config: RivetConfig;

    try {
      config = loadConfig(cwd);
      if (!config.provider || !config.model) {
        configMissing = true;
      }
    } catch {
      configMissing = true;
      config = { provider: 'openai_compatible', model: '', api_key_env: 'RIVET_API_KEY' };
    }

    if (!configMissing && !opts.set) {
      const perms = loadPermissions(cwd);
      const ctx: BootContext = {
        provider: config.provider,
        model: config.model,
        workspace: cwd,
        writeEnabled: perms.write_file,
        commandsEnabled: perms.run_command,
        demoMode: config.provider === 'demo',
      };
      console.log(bootScreen(ctx));
      process.stdout.write(statusBar(ctx));
    }

    if (opts.set) {
      const [key, ...valueParts] = opts.set.split('=');
      const value = valueParts.join('=');

      if (!key || !value) {
        console.log(theme.error('  Invalid format. Use --set key=value'));
        process.exit(1);
      }

      if (looksLikeLiteralKey(value) && key === 'api_key_env') {
        console.log(theme.error('  api_key_env must be an environment variable name (e.g. OPENAI_API_KEY), not a literal key.'));
        process.exit(1);
      }

      (config as unknown as Record<string, string>)[key] = value;
      saveConfig(cwd, config);
      console.log(theme.success(`  Updated: ${key} = ${value}`));
      return;
    }

    if (configMissing) {
      console.log(theme.bold('  First-time setup'));
      console.log(divider());
      config = await runProviderWizard(config);
      saveConfig(cwd, config);
      console.log('');
      console.log(theme.success('  Configuration saved.'));
      printConfig(config);
      printNextSteps(config);
      return;
    }

    printConfig(config);

    const action = await askSelect('What would you like to do?', [
      'Change provider (runs wizard)',
      'Change model',
      'Change base URL',
      'Change API key env variable',
      'Exit',
    ]);

    if (action === 4) return;

    if (action === 0) {
      config = await runProviderWizard(config);
    } else if (action === 1) {
      const val = await askInput('Model:', config.model);
      config.model = val;
    } else if (action === 2) {
      const val = await askInput('Base URL:', config.base_url || '');
      config.base_url = val || undefined;
    } else if (action === 3) {
      const val = await askInput('API key env var name (e.g. OPENAI_API_KEY):', config.api_key_env || '');
      if (looksLikeLiteralKey(val)) {
        console.log(theme.error('  That looks like a literal API key. Enter the env var name instead.'));
        process.exit(1);
      }
      config.api_key_env = val;
    }

    saveConfig(cwd, config);
    console.log(theme.success('  Configuration updated.'));
  });

async function runProviderWizard(existing: RivetConfig): Promise<RivetConfig> {
  console.log('');
  console.log(theme.brandBold('  Pick a brain'));
  console.log(divider());
  console.log('');

  for (let i = 0; i < PROVIDER_PRESETS.length; i++) {
    console.log(`  ${theme.highlight(`${i + 1}`)}. ${PROVIDER_PRESETS[i].label}`);
  }
  console.log('');

  const providerIdx = await askSelect('Which provider?', PROVIDER_PRESETS.map((p) => p.label));
  const preset = PROVIDER_PRESETS[providerIdx] || PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1];

  if (preset.provider === 'demo') {
    return { provider: 'demo', model: 'none', api_key_env: '' };
  }

  if (preset.label === 'Custom OpenAI-compatible') {
    const baseUrl = await askInput('Base URL:', '');
    const model = await askInput('Model name:', '');
    const keyEnv = await askInput('API key env var name:', '');

    if (looksLikeLiteralKey(keyEnv)) {
      console.log(theme.error('  That looks like a literal API key. Use an env var name.'));
      process.exit(1);
    }

    return {
      provider: 'openai_compatible',
      model: model || 'gpt-4.1-mini',
      base_url: baseUrl,
      api_key_env: keyEnv,
    };
  }

  const modelAnswer = await askInput(`Model [${preset.default_model}]:`, preset.default_model);

  const config: RivetConfig = {
    provider: preset.provider,
    model: modelAnswer,
    api_key_env: preset.api_key_env,
  };

  if (preset.base_url) {
    config.base_url = preset.base_url;
  }

  if (config.api_key_env && looksLikeLiteralKey(config.api_key_env)) {
    console.log(theme.error('  api_key_env looks like a literal key. Please set an env var name.'));
    process.exit(1);
  }

  if (preset.note) {
    console.log(theme.dim(`  Note: ${preset.note}`));
  }

  return config;
}

function printConfig(config: RivetConfig): void {
  console.log('');
  console.log(theme.bold('  Current Configuration'));
  console.log(divider());
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined) {
      console.log(`  ${theme.dim(key.padEnd(16))} ${value}`);
    }
  }
  console.log(divider());
  console.log('');
}

function printNextSteps(config: RivetConfig): void {
  if (config.provider === 'demo') {
    console.log(theme.bold('  Next steps'));
    console.log(divider());
    console.log(`  1. Try the demo:      ${theme.highlight('rivet demo')}`);
    console.log(`  2. Explore in chat:   ${theme.highlight('rivet chat')}`);
    console.log(`  3. Configure later:   ${theme.highlight('rivet config')}`);
    console.log('');
    return;
  }

  console.log(theme.bold('  Next steps'));
  console.log(divider());
  const envVar = config.api_key_env || 'RIVET_API_KEY';
  console.log(`  1. Set your API key:  ${theme.highlight(`export ${envVar}=<your-key>`)}`);
  console.log(`  2. Start chatting:    ${theme.highlight('rivet chat')}`);
  console.log(`  3. Or run a task:     ${theme.highlight('rivet run "describe this project"')}`);
  console.log(`  4. Self-test:         ${theme.highlight('rivet doctor')}`);
  console.log('');
}

function askSelect(prompt: string, choices: string[]): Promise<number> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('');
    for (let i = 0; i < choices.length; i++) {
      console.log(`  ${theme.highlight(`${i + 1}`)}. ${choices[i]}`);
    }
    console.log('');
    rl.question(theme.brand(`  ${prompt} (enter number) `), (answer) => {
      rl.close();
      const idx = parseInt(answer.trim(), 10) - 1;
      if (idx >= 0 && idx < choices.length) {
        resolve(idx);
      } else {
        resolve(choices.length - 1);
      }
    });
  });
}

function askInput(prompt: string, defaultVal = ''): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const hint = defaultVal ? ` [${defaultVal}]` : '';
    rl.question(theme.brand(`  ${prompt}${hint} `), (answer) => {
      rl.close();
      resolve(answer.trim() || defaultVal);
    });
  });
}
