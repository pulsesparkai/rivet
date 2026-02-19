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
exports.chatCommand = void 0;
const commander_1 = require("commander");
const readline = __importStar(require("readline"));
const core_1 = require("@pulsespark/core");
const providers_1 = require("@pulsespark/providers");
const theme_1 = require("../ui/theme");
const approval_handler_1 = require("../ui/approval-handler");
exports.chatCommand = new commander_1.Command('chat')
    .description('Start an interactive agent chat session')
    .option('--dry-run', 'Plan only, do not execute actions')
    .option('--yes', 'Auto-approve low-risk actions')
    .action(async (opts) => {
    const cwd = process.cwd();
    if (!(0, core_1.isInitialized)(cwd)) {
        console.log(theme_1.theme.error(' Rivet is not initialized. Run `rivet init` first.'));
        process.exit(1);
    }
    console.log((0, theme_1.banner)());
    console.log(theme_1.theme.dim(' Type your message, or use commands:'));
    console.log(theme_1.theme.dim(' /plan /tools /permissions /exit'));
    console.log((0, theme_1.divider)());
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
    agent.startRun('interactive-chat', config.provider, config.model);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const prompt = () => {
        rl.question(theme_1.theme.brand('\n > '), async (input) => {
            const trimmed = input.trim();
            if (!trimmed) {
                prompt();
                return;
            }
            if (trimmed === '/exit' || trimmed === '/quit') {
                console.log(theme_1.theme.dim(' Goodbye!'));
                agent.completeRun('Session ended by user');
                rl.close();
                process.exit(0);
            }
            if (trimmed === '/tools') {
                console.log(theme_1.theme.bold('\n Available tools:'));
                console.log('  - list_dir(path)');
                console.log('  - read_file(path)');
                console.log('  - write_file(path, content)');
                console.log('  - run_command(command, cwd)');
                console.log('  - search_in_files(query, globs)');
                prompt();
                return;
            }
            if (trimmed === '/plan') {
                await agent.processMessage('Please create a detailed plan for what we have discussed so far.');
                prompt();
                return;
            }
            if (trimmed === '/permissions') {
                const { loadPermissions } = await Promise.resolve().then(() => __importStar(require('@pulsespark/core')));
                const perms = loadPermissions(cwd);
                console.log(theme_1.theme.bold('\n Permissions:'));
                console.log(`  write_file:    ${perms.write_file ? theme_1.theme.success('allowed') : theme_1.theme.error('denied')}`);
                console.log(`  run_command:   ${perms.run_command ? theme_1.theme.success('allowed') : theme_1.theme.error('denied')}`);
                console.log(`  require_approval: ${perms.require_approval_for_commands ? 'yes' : 'no'}`);
                console.log(`  workspace_root: ${perms.workspace_root}`);
                prompt();
                return;
            }
            try {
                await agent.processMessage(trimmed);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.log(theme_1.theme.error(` Error: ${msg}`));
            }
            prompt();
        });
    };
    prompt();
});
