"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configCommand = void 0;
const commander_1 = require("commander");
const inquirer_1 = __importDefault(require("inquirer"));
const core_1 = require("@pulsespark/core");
const providers_1 = require("@pulsespark/providers");
const theme_1 = require("../ui/theme");
exports.configCommand = new commander_1.Command('config')
    .description('View and update provider configuration')
    .option('--set <key=value>', 'Set a config value (e.g. --set model=gpt-4)')
    .action(async (opts) => {
    const cwd = process.cwd();
    if (!(0, core_1.isInitialized)(cwd)) {
        console.log(theme_1.theme.error(' Rivet is not initialized. Run `rivet init` first.'));
        process.exit(1);
    }
    const config = (0, providers_1.loadConfig)(cwd);
    if (opts.set) {
        const [key, ...valueParts] = opts.set.split('=');
        const value = valueParts.join('=');
        if (!key || !value) {
            console.log(theme_1.theme.error(' Invalid format. Use --set key=value'));
            process.exit(1);
        }
        config[key] = value;
        (0, providers_1.saveConfig)(cwd, config);
        console.log(theme_1.theme.success(` Updated: ${key} = ${value}`));
        return;
    }
    console.log(theme_1.theme.bold(' Current Configuration:'));
    console.log((0, theme_1.divider)());
    for (const [key, value] of Object.entries(config)) {
        console.log(`  ${theme_1.theme.bold(key.padEnd(15))} ${value}`);
    }
    console.log((0, theme_1.divider)());
    const { action } = await inquirer_1.default.prompt([
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
    if (action === 'exit')
        return;
    if (action === 'provider') {
        const { provider } = await inquirer_1.default.prompt([
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
        }
        else if (provider === 'openai_compatible') {
            config.base_url = config.base_url || 'https://api.openai.com/v1';
            config.api_key_env = config.api_key_env || 'OPENAI_API_KEY';
        }
    }
    else {
        const { value } = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'value',
                message: `Enter new value for ${action}:`,
                default: config[action] || '',
            },
        ]);
        config[action] = value;
    }
    (0, providers_1.saveConfig)(cwd, config);
    console.log(theme_1.theme.success(' Configuration updated.'));
});
