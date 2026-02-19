"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCommand = void 0;
const commander_1 = require("commander");
const ora_1 = __importDefault(require("ora"));
const core_1 = require("@pulsespark/core");
const providers_1 = require("@pulsespark/providers");
const theme_1 = require("../ui/theme");
const approval_handler_1 = require("../ui/approval-handler");
exports.runCommand = new commander_1.Command('run')
    .description('Execute a task in one-shot mode')
    .argument('<task>', 'Task description to execute')
    .option('--dry-run', 'Plan only, do not execute actions')
    .option('--yes', 'Auto-approve low-risk actions')
    .action(async (task, opts) => {
    const cwd = process.cwd();
    if (!(0, core_1.isInitialized)(cwd)) {
        console.log(theme_1.theme.error(' Rivet is not initialized. Run `rivet init` first.'));
        process.exit(1);
    }
    console.log((0, theme_1.banner)());
    console.log(theme_1.theme.bold(` Task: ${task}`));
    console.log('');
    const config = (0, providers_1.loadConfig)(cwd);
    const provider = (0, providers_1.createProvider)(config, cwd);
    const handler = new approval_handler_1.TerminalApprovalHandler();
    const agent = new core_1.AgentLoop({
        provider,
        handler,
        workspaceRoot: cwd,
        dryRun: opts.dryRun || false,
        autoApprove: opts.yes || false,
    });
    agent.startRun(task, config.provider, config.model);
    const spinner = (0, ora_1.default)({
        text: 'Thinking...',
        color: 'cyan',
    }).start();
    try {
        spinner.stop();
        const result = await agent.runTask(task);
        agent.completeRun(result);
        console.log('');
        console.log(theme_1.theme.success(' Task completed.'));
        console.log('');
    }
    catch (err) {
        spinner.stop();
        const msg = err instanceof Error ? err.message : String(err);
        agent.failRun(msg);
        console.log(theme_1.theme.error(` Task failed: ${msg}`));
        process.exit(1);
    }
});
