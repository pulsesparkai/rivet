import { Command } from 'commander';
import ora from 'ora';
import { AgentLoop, isInitialized } from '@pulsespark/core';
import { createProvider, loadConfig } from '@pulsespark/providers';
import { theme, banner } from '../ui/theme';
import { TerminalApprovalHandler } from '../ui/approval-handler';

export const runCommand = new Command('run')
  .description('Execute a task in one-shot mode')
  .argument('<task>', 'Task description to execute')
  .option('--dry-run', 'Plan only, do not execute actions')
  .option('--yes', 'Auto-approve low-risk actions')
  .action(async (task: string, opts) => {
    const cwd = process.cwd();

    if (!isInitialized(cwd)) {
      console.log(theme.error(' Rivet is not initialized. Run `rivet init` first.'));
      process.exit(1);
    }

    console.log(banner());
    console.log(theme.bold(` Task: ${task}`));
    console.log('');

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

    agent.startRun(task, config.provider, config.model);

    const spinner = ora({
      text: 'Thinking...',
      color: 'cyan',
    }).start();

    try {
      spinner.stop();
      const result = await agent.runTask(task);
      agent.completeRun(result);

      console.log('');
      console.log(theme.success(' Task completed.'));
      console.log('');
    } catch (err) {
      spinner.stop();
      const msg = err instanceof Error ? err.message : String(err);
      agent.failRun(msg);
      console.log(theme.error(` Task failed: ${msg}`));
      process.exit(1);
    }
  });
