import { Command } from 'commander';
import ora from 'ora';
import { AgentLoop, isInitialized, loadPermissions, loadSoulSafe, summarizeSoul, SecretStore } from '@pulsesparkai/core';
import { createProvider, loadConfig } from '@pulsesparkai/providers';
import { theme, bootScreen, statusBar } from '../ui/theme';
import { TerminalApprovalHandler } from '../ui/approval-handler';
import type { BootContext } from '../ui/theme';

export const runCommand = new Command('run')
  .description('Execute a task in one-shot mode')
  .argument('<task>', 'Task description to execute')
  .option('--dry-run', 'Plan only, do not execute actions')
  .option('--yes', 'Auto-approve low-risk actions')
  .action(async (task: string, opts) => {
    const cwd = process.env.INIT_CWD ?? process.cwd();

    if (!isInitialized(cwd)) {
      console.log(theme.error(' Rivet is not initialized. Run `rivet init` first.'));
      process.exit(1);
    }

    const config = loadConfig(cwd);
    const perms = loadPermissions(cwd);

    const ctx: BootContext = {
      provider: config.provider,
      model: config.model,
      workspace: cwd,
      writeEnabled: perms.write_file,
      commandsEnabled: perms.run_command,
      dryRun: opts.dryRun || false,
      demoMode: config.provider === 'demo',
    };

    console.log(bootScreen(ctx));
    process.stdout.write(statusBar(ctx));

    console.log(theme.bold(`  Task: ${task}`));
    console.log('');

    if (config.provider === 'demo') {
      console.log(theme.warning('  DEMO MODE: Cannot execute tasks without a provider.'));
      console.log(theme.dim('  Configure a provider: rivet config'));
      process.exit(1);
    }

    const secretStore = new SecretStore(cwd);
    if (config.api_key_env && !process.env[config.api_key_env]) {
      const fromStore = secretStore.get(config.api_key_env);
      if (fromStore) {
        process.env[config.api_key_env] = fromStore;
      }
    }

    const soulResult = loadSoulSafe(cwd);
    let soulContext: string | undefined;
    if (soulResult) {
      if (soulResult.hadSecrets) {
        console.log(theme.warning('  WARNING: .rivet/soul.md contains secrets. They have been redacted.'));
        console.log('');
      }
      soulContext = summarizeSoul(soulResult.content);
    }

    const provider = createProvider(config, cwd);
    const handler = new TerminalApprovalHandler();

    const agent = new AgentLoop({
      provider,
      handler,
      workspaceRoot: cwd,
      dryRun: opts.dryRun || false,
      autoApprove: opts.yes || false,
      soulContext,
      buildCommand: config.build_command,
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
