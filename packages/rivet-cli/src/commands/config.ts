import { Command } from 'commander';
import inquirer from 'inquirer';
import { isInitialized } from '@pulsespark/core';
import { loadConfig, saveConfig } from '@pulsespark/providers';
import { theme, divider } from '../ui/theme';

export const configCommand = new Command('config')
  .description('View and update provider configuration')
  .option('--set <key=value>', 'Set a config value (e.g. --set model=gpt-4)')
  .action(async (opts) => {
    const cwd = process.cwd();

    if (!isInitialized(cwd)) {
      console.log(theme.error(' Rivet is not initialized. Run `rivet init` first.'));
      process.exit(1);
    }

    const config = loadConfig(cwd);

    if (opts.set) {
      const [key, ...valueParts] = opts.set.split('=');
      const value = valueParts.join('=');

      if (!key || !value) {
        console.log(theme.error(' Invalid format. Use --set key=value'));
        process.exit(1);
      }

      (config as unknown as Record<string, string>)[key] = value;
      saveConfig(cwd, config);
      console.log(theme.success(` Updated: ${key} = ${value}`));
      return;
    }

    console.log(theme.bold(' Current Configuration:'));
    console.log(divider());
    for (const [key, value] of Object.entries(config)) {
      console.log(`  ${theme.bold(key.padEnd(15))} ${value}`);
    }
    console.log(divider());

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Change provider', value: 'provider' },
          { name: 'Change model', value: 'model' },
          { name: 'Change base URL', value: 'base_url' },
          { name: 'Change API key env variable', value: 'api_key_env' },
          { name: 'Exit', value: 'exit' },
        ],
      },
    ]);

    if (action === 'exit') return;

    if (action === 'provider') {
      const { provider } = await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message: 'Select provider:',
          choices: [
            { name: 'OpenAI Compatible (OpenAI, Together, Groq, etc.)', value: 'openai_compatible' },
            { name: 'Anthropic (Claude)', value: 'anthropic' },
            { name: 'Custom HTTP (any API)', value: 'custom_http' },
          ],
        },
      ]);
      config.provider = provider;

      if (provider === 'anthropic') {
        config.api_key_env = 'ANTHROPIC_API_KEY';
        config.model = 'claude-sonnet-4-20250514';
        delete config.base_url;
      } else if (provider === 'openai_compatible') {
        config.base_url = config.base_url || 'https://api.openai.com/v1';
        config.api_key_env = config.api_key_env || 'OPENAI_API_KEY';
      }
    } else {
      const { value } = await inquirer.prompt([
        {
          type: 'input',
          name: 'value',
          message: `Enter new value for ${action}:`,
          default: (config as unknown as Record<string, string>)[action] || '',
        },
      ]);
      (config as unknown as Record<string, string>)[action] = value;
    }

    saveConfig(cwd, config);
    console.log(theme.success(' Configuration updated.'));
  });
