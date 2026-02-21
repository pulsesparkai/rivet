import { Command } from 'commander';
import * as readline from 'readline';
import {
  AgentLoop,
  isInitialized,
  loadPermissions,
  WorkflowRunner,
  loadWorkflow,
  listWorkflows,
  saveWorkflow,
  BUILTIN_WORKFLOWS,
} from '@pulsesparkai/core';
import { createProvider, loadConfig } from '@pulsesparkai/providers';
import { theme, divider, bootScreen, statusBar } from '../ui/theme';
import { TerminalApprovalHandler } from '../ui/approval-handler';
import type { BootContext } from '../ui/theme';
import type { WorkflowStep, WorkflowRunState } from '@pulsesparkai/core';

export const workflowCommand = new Command('workflow')
  .description('Run autonomous multi-step workflows');

workflowCommand
  .command('list')
  .description('List available workflows')
  .action(() => {
    const cwd = process.cwd();

    console.log('');
    console.log(theme.bold(' Available Workflows'));
    console.log(divider());

    console.log(theme.dim(' Built-in:'));
    for (const wf of BUILTIN_WORKFLOWS) {
      console.log(`  ${theme.highlight(wf.name.padEnd(20))} ${wf.description}`);
      if (wf.parameters) {
        const params = Object.entries(wf.parameters)
          .map(([k, v]) => `${k}${v.required ? '*' : ''}`)
          .join(', ');
        console.log(`  ${theme.dim('  params: ' + params)}`);
      }
    }

    const custom = listWorkflows(cwd);
    if (custom.length > 0) {
      console.log('');
      console.log(theme.dim(' Custom (.rivet/workflows/):'));
      for (const wf of custom) {
        console.log(`  ${theme.highlight(wf.name.padEnd(20))} ${wf.description}`);
      }
    }

    console.log(divider());
    console.log(theme.dim(' Run: rivet workflow run <name> [--param key=value ...]'));
    console.log('');
  });

workflowCommand
  .command('init')
  .description('Install built-in workflow templates to .rivet/workflows/')
  .action(() => {
    const cwd = process.cwd();

    for (const wf of BUILTIN_WORKFLOWS) {
      saveWorkflow(cwd, wf);
      console.log(theme.success(` Saved: ${wf.name}`));
    }

    console.log('');
    console.log(theme.dim(' Workflows saved to .rivet/workflows/'));
    console.log(theme.dim(' Edit them to customize for your use case.'));
  });

workflowCommand
  .command('run <name>')
  .description('Execute a workflow')
  .option('-p, --param <params...>', 'Parameters as key=value pairs')
  .option('--dry-run', 'Show steps without executing')
  .option('--yes', 'Auto-approve all steps')
  .action(async (name: string, opts: { param?: string[]; dryRun?: boolean; yes?: boolean }) => {
    const cwd = process.cwd();

    if (!isInitialized(cwd)) {
      console.log(theme.error(' Rivet is not initialized. Run `rivet init` first.'));
      process.exit(1);
    }

    let workflow = loadWorkflow(cwd, name);
    if (!workflow) {
      workflow = BUILTIN_WORKFLOWS.find(w => w.name === name) || null;
    }
    if (!workflow) {
      console.log(theme.error(` Workflow not found: ${name}`));
      console.log(theme.dim(' Available: rivet workflow list'));
      process.exit(1);
    }

    const params: Record<string, string> = {};
    if (opts.param) {
      for (const p of opts.param) {
        const eq = p.indexOf('=');
        if (eq > 0) {
          params[p.slice(0, eq)] = p.slice(eq + 1);
        }
      }
    }

    if (workflow.parameters) {
      for (const [key, def] of Object.entries(workflow.parameters)) {
        if (!params[key] && def.required) {
          console.log(theme.error(` Missing required parameter: ${key} (${def.description})`));
          process.exit(1);
        }
        if (!params[key] && def.default) {
          params[key] = def.default;
        }
      }
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

    console.log('');
    console.log(theme.bold(` Workflow: ${workflow.name}`));
    console.log(divider());
    console.log(`  ${theme.dim('Description:')} ${workflow.description}`);
    console.log(`  ${theme.dim('Steps:')}       ${workflow.steps.length}`);
    console.log(`  ${theme.dim('Provider:')}    ${config.provider}/${config.model}`);
    if (Object.keys(params).length > 0) {
      console.log(`  ${theme.dim('Parameters:')}`);
      for (const [k, v] of Object.entries(params)) {
        console.log(`    ${theme.highlight(k)} = ${v}`);
      }
    }
    console.log(divider());

    if (opts.dryRun) {
      console.log('');
      console.log(theme.warning(' [DRY RUN] Steps that would execute:'));
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const approval = step.requires_approval ? theme.warning(' [approval]') : '';
        console.log(`  ${i + 1}. ${theme.highlight(step.name)}${approval}`);
        console.log(`     ${theme.dim(step.prompt.slice(0, 100))}...`);
      }
      console.log('');
      return;
    }

    if (config.provider === 'demo') {
      console.log(theme.error(' Cannot run workflows in demo mode. Configure a provider first.'));
      process.exit(1);
    }

    const provider = createProvider(config, cwd);
    const handler = new TerminalApprovalHandler();

    const runner = new WorkflowRunner({
      workflow,
      parameters: params,
      executeStep: async (prompt: string, stepName: string) => {
        const agent = new AgentLoop({
          provider,
          handler,
          workspaceRoot: cwd,
          autoApprove: opts.yes || false,
          buildCommand: config.build_command,
          maxIterations: 10,
        });
        agent.startRun(`workflow:${workflow!.name}:${stepName}`, config.provider, config.model);
        try {
          const result = await agent.runTask(prompt);
          agent.completeRun(result);
          return result;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          agent.failRun(msg);
          throw err;
        }
      },
      onApproval: async (step: WorkflowStep) => {
        if (opts.yes) return true;

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise<string>((resolve) => {
          console.log('');
          console.log(theme.warning(`  Step "${step.name}" requires approval.`));
          console.log(theme.dim(`  ${step.prompt.slice(0, 200)}...`));
          rl.question(theme.brand('  Approve? (y/n) '), (ans) => {
            rl.close();
            resolve(ans.trim().toLowerCase());
          });
        });
        return answer === 'y' || answer === 'yes';
      },
      onProgress: (state: WorkflowRunState) => {
        const pct = Math.round((state.currentStep / state.totalSteps) * 100);
        const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
        console.log(`  ${theme.brand(`[${bar}]`)} ${pct}% - Step ${state.currentStep}/${state.totalSteps} ${theme.dim(state.status)}`);
      },
    });

    console.log('');
    console.log(theme.bold(' Executing workflow...'));
    console.log('');

    const finalState = await runner.run();

    console.log('');
    console.log(divider());
    if (finalState.status === 'completed') {
      console.log(theme.success(` Workflow "${workflow.name}" completed successfully.`));
    } else if (finalState.status === 'failed') {
      console.log(theme.error(` Workflow "${workflow.name}" failed.`));
      const failedStep = finalState.stepResults.find(s => s.status === 'failed');
      if (failedStep) {
        console.log(theme.dim(`  Failed at: ${failedStep.stepName}`));
        console.log(theme.dim(`  Error: ${failedStep.error}`));
      }
    } else if (finalState.status === 'paused') {
      console.log(theme.warning(` Workflow "${workflow.name}" paused (approval denied).`));
    }

    console.log('');
    console.log(theme.bold(' Step Results:'));
    for (const sr of finalState.stepResults) {
      const statusFn = sr.status === 'completed' ? theme.success
        : sr.status === 'failed' ? theme.error
        : theme.warning;
      console.log(`  ${statusFn(sr.status.padEnd(10))} ${theme.highlight(sr.stepName)} (${sr.durationMs}ms, ${sr.retries} retries)`);
    }
    console.log(divider());
  });
