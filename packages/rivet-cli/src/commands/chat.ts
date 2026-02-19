import { Command } from 'commander';
import * as readline from 'readline';
import { AgentLoop, isInitialized } from '@pulsespark/core';
import { createProvider, loadConfig } from '@pulsespark/providers';
import { theme, banner, divider } from '../ui/theme';
import { TerminalApprovalHandler } from '../ui/approval-handler';

export const chatCommand = new Command('chat')
  .description('Start an interactive agent chat session')
  .option('--dry-run', 'Plan only, do not execute actions')
  .option('--yes', 'Auto-approve low-risk actions')
  .action(async (opts) => {
    const cwd = process.cwd();

    if (!isInitialized(cwd)) {
      console.log(theme.error(' Rivet is not initialized. Run `rivet init` first.'));
      process.exit(1);
    }

    console.log(banner());
    console.log(theme.dim(' Type your message, or use commands:'));
    console.log(theme.dim(' /plan /tools /permissions /exit'));
    console.log(divider());

    const config = loadConfig(cwd);
    const provider = createProvider(config, cwd);
    const handler = new TerminalApprovalHandler();

    const agent = new AgentLoop({
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
      rl.question(theme.brand('\n > '), async (input) => {
        const trimmed = input.trim();

        if (!trimmed) {
          prompt();
          return;
        }

        if (trimmed === '/exit' || trimmed === '/quit') {
          console.log(theme.dim(' Goodbye!'));
          agent.completeRun('Session ended by user');
          rl.close();
          process.exit(0);
        }

        if (trimmed === '/tools') {
          console.log(theme.bold('\n Available tools:'));
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
          const { loadPermissions } = await import('@pulsespark/core');
          const perms = loadPermissions(cwd);
          console.log(theme.bold('\n Permissions:'));
          console.log(`  write_file:    ${perms.write_file ? theme.success('allowed') : theme.error('denied')}`);
          console.log(`  run_command:   ${perms.run_command ? theme.success('allowed') : theme.error('denied')}`);
          console.log(`  require_approval: ${perms.require_approval_for_commands ? 'yes' : 'no'}`);
          console.log(`  workspace_root: ${perms.workspace_root}`);
          prompt();
          return;
        }

        try {
          await agent.processMessage(trimmed);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(theme.error(` Error: ${msg}`));
        }

        prompt();
      });
    };

    prompt();
  });
