import { Command } from 'commander';
import * as readline from 'readline';
import * as path from 'path';
import { AgentLoop, isInitialized, loadPermissions } from '@pulsespark/core';
import { createProvider, loadConfig } from '@pulsespark/providers';
import type { RivetConfig, PermissionsConfig } from '@pulsespark/shared';
import { theme, bootScreen, statusBar, divider } from '../ui/theme';
import { TerminalApprovalHandler } from '../ui/approval-handler';
import type { BootContext } from '../ui/theme';

export const chatCommand = new Command('chat')
  .description('Start an interactive agent chat session')
  .option('--dry-run', 'Plan only, do not execute actions')
  .option('--yes', 'Auto-approve low-risk actions')
  .option('--debug', 'Show full error stack traces')
  .action(async (opts) => {
    const cwd = process.cwd();

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
    };

    console.log(bootScreen(ctx));
    console.log(theme.dim('  Type a message, or /help for commands.'));
    console.log('');

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

    const showStatus = () => {
      process.stdout.write(statusBar(ctx));
    };

    const prompt = () => {
      showStatus();
      rl.question(theme.brand(' > '), async (input) => {
        const trimmed = input.trim();

        if (!trimmed) {
          prompt();
          return;
        }

        if (trimmed === '/exit' || trimmed === '/quit') {
          console.log('');
          console.log(theme.dim('  Session ended.'));
          agent.completeRun('Session ended by user');
          rl.close();
          process.exit(0);
        }

        if (trimmed === '/help') {
          printHelp();
          prompt();
          return;
        }

        if (trimmed === '/about') {
          printAbout();
          prompt();
          return;
        }

        if (trimmed === '/status') {
          printStatus(ctx, config, perms);
          prompt();
          return;
        }

        if (trimmed === '/tools') {
          printTools();
          prompt();
          return;
        }

        if (trimmed === '/permissions') {
          printPermissions(perms, cwd);
          prompt();
          return;
        }

        if (trimmed === '/plan') {
          try {
            await agent.processMessage(
              'Summarize the current task and provide a detailed step-by-step plan. If no task has been discussed yet, ask: "Tell me your goal in one sentence."'
            );
          } catch (err) {
            handleError(err, opts.debug);
          }
          prompt();
          return;
        }

        try {
          await agent.processMessage(trimmed);
        } catch (err) {
          handleError(err, opts.debug);
        }

        prompt();
      });
    };

    prompt();
  });

function handleError(err: unknown, debug?: boolean): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.log('');
  console.log(theme.error('  Error: ') + msg);
  if (debug && err instanceof Error && err.stack) {
    console.log(theme.dim(err.stack));
  } else {
    console.log(theme.dim('  Run with --debug for full details.'));
  }
  console.log('');
}

function printHelp(): void {
  console.log('');
  console.log(theme.bold('  Commands'));
  console.log(divider());
  const cmds = [
    ['/help', 'Show this help'],
    ['/about', 'About Rivet by PulseSpark.ai'],
    ['/status', 'Show provider, model, permissions'],
    ['/plan', 'Ask the agent to state its plan'],
    ['/tools', 'List available agent tools'],
    ['/permissions', 'Show current permission settings'],
    ['/exit', 'End the session'],
  ];
  for (const [cmd, desc] of cmds) {
    console.log(`  ${theme.highlight(cmd.padEnd(16))} ${theme.dim(desc)}`);
  }
  console.log('');
  console.log(theme.bold('  Approvals'));
  console.log(divider());
  console.log(theme.dim('  When the agent proposes a write or command, you will be prompted:'));
  console.log(`  ${theme.highlight('y')} approve   ${theme.highlight('n')} deny   ${theme.highlight('a')} always allow for this session`);
  console.log('');
}

function printAbout(): void {
  console.log('');
  console.log(theme.bold('  Rivet by PulseSpark.ai'));
  console.log(divider());
  console.log(theme.dim('  Open-source agentic CLI. Runs 100% locally.'));
  console.log(theme.dim('  Security-first: every file write and command requires approval.'));
  console.log(theme.dim('  Works with any LLM: OpenAI, Anthropic, Ollama, OpenRouter, and more.'));
  console.log('');
  console.log(`  ${theme.dim('Repo:')} ${theme.highlight('https://github.com/pulsesparkai/rivet')}`);
  console.log(`  ${theme.dim('Docs:')} ${theme.highlight('https://rivet.pulsesparkai.com')}`);
  console.log('');
}

function printStatus(ctx: BootContext, config: RivetConfig, perms: PermissionsConfig): void {
  console.log('');
  console.log(theme.bold('  Status'));
  console.log(divider());
  console.log(`  ${theme.dim('provider')}    ${theme.highlight(ctx.provider)}`);
  console.log(`  ${theme.dim('model')}       ${theme.highlight(ctx.model)}`);
  console.log(`  ${theme.dim('workspace')}   ${theme.muted(ctx.workspace)}`);
  console.log(`  ${theme.dim('write_file')}  ${perms.write_file ? theme.success('allowed') : theme.error('denied')}`);
  console.log(`  ${theme.dim('run_cmd')}     ${perms.run_command ? theme.success('allowed') : theme.error('denied')}`);
  console.log(`  ${theme.dim('approvals')}   ${perms.require_approval_for_commands ? 'required' : 'off'}`);
  if (ctx.dryRun) console.log(`  ${theme.dim('mode')}        ${theme.warning('dry-run')}`);
  console.log('');
}

function printTools(): void {
  console.log('');
  console.log(theme.bold('  Available tools'));
  console.log(divider());
  const tools = [
    ['list_dir(path)', 'low', 'List directory contents'],
    ['read_file(path)', 'low', 'Read a file'],
    ['write_file(path, content)', 'medium', 'Write a file (approval required)'],
    ['run_command(cmd, cwd)', 'high', 'Execute a command (approval required)'],
    ['search_in_files(query, globs)', 'low', 'Search patterns across files'],
  ];
  for (const [name, risk, desc] of tools) {
    const riskLabel = risk === 'low' ? theme.success(risk) : risk === 'medium' ? theme.warning(risk) : theme.danger(risk);
    console.log(`  ${theme.highlight(name.padEnd(28))} ${riskLabel.padEnd(8)} ${theme.dim(desc)}`);
  }
  console.log('');
}

function printPermissions(perms: PermissionsConfig, cwd: string): void {
  console.log('');
  console.log(theme.bold('  Permissions'));
  console.log(divider());
  console.log(`  ${theme.dim('workspace_root')}  ${perms.workspace_root}`);
  console.log(`  ${theme.dim('write_file')}      ${perms.write_file ? theme.success('allowed') : theme.error('denied')}`);
  console.log(`  ${theme.dim('run_command')}      ${perms.run_command ? theme.success('allowed') : theme.error('denied')}`);
  console.log(`  ${theme.dim('require_approval')} ${perms.require_approval_for_commands ? 'yes' : 'no'}`);
  console.log(`  ${theme.dim('diff_approval')}    ${perms.require_diff_approval ? 'yes' : 'no'}`);
  const denials = Array.isArray(perms.deny_patterns) ? perms.deny_patterns.length : 0;
  console.log(`  ${theme.dim('deny_patterns')}    ${denials} patterns`);
  console.log(`  ${theme.dim('config')}           ${path.join(cwd, '.rivet', 'permissions.json')}`);
  console.log('');
}
