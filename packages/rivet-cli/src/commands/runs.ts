import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
  RunLogger,
  diffRuns,
  formatDiff,
  AgentLoop,
  isInitialized,
  loadPermissions,
} from '@pulsesparkai/core';
import { createProvider, loadConfig } from '@pulsesparkai/providers';
import { theme, divider } from '../ui/theme';
import { TerminalApprovalHandler } from '../ui/approval-handler';
import type { ExecutionTrace } from '@pulsesparkai/core';

export const runsCommand = new Command('runs')
  .description('Manage agent runs: diff, replay, inspect traces');

runsCommand
  .command('diff <id1> <id2>')
  .description('Compare two runs side-by-side')
  .action((id1: string, id2: string) => {
    const cwd = process.cwd();
    const left = RunLogger.getRunById(cwd, id1);
    const right = RunLogger.getRunById(cwd, id2);

    if (!left) {
      console.log(theme.error(` Run not found: ${id1}`));
      return;
    }
    if (!right) {
      console.log(theme.error(` Run not found: ${id2}`));
      return;
    }

    const result = diffRuns(left, right);
    const formatted = formatDiff(result, left.id, right.id);

    console.log('');
    console.log(theme.bold(' Run Diff'));
    console.log(divider());
    for (const line of formatted.split('\n')) {
      if (line.startsWith('  +')) {
        console.log(theme.success(line));
      } else if (line.startsWith('  -')) {
        console.log(theme.error(line));
      } else if (line.startsWith('  ~')) {
        console.log(theme.warning(line));
      } else {
        console.log(line);
      }
    }
    console.log(divider());
  });

runsCommand
  .command('trace <id>')
  .description('Show execution trace for a run')
  .action((id: string) => {
    const cwd = process.cwd();
    const run = RunLogger.getRunById(cwd, id);

    if (!run) {
      console.log(theme.error(` Run not found: ${id}`));
      return;
    }

    const tracePath = path.join(cwd, '.rivet', 'runs', `${run.id}.trace.json`);
    if (!fs.existsSync(tracePath)) {
      console.log(theme.warning(` No execution trace found for run ${id}`));
      console.log(theme.dim(' Traces are generated for runs started after this feature was added.'));
      return;
    }

    try {
      const trace = JSON.parse(fs.readFileSync(tracePath, 'utf-8')) as ExecutionTrace;

      console.log('');
      console.log(theme.bold(` Execution Trace: ${run.id.slice(0, 8)}`));
      console.log(divider());
      console.log(`  ${theme.dim('Provider:')}  ${trace.provider}`);
      console.log(`  ${theme.dim('Model:')}     ${trace.model}`);
      console.log(`  ${theme.dim('Started:')}   ${trace.startedAt}`);
      console.log(`  ${theme.dim('Steps:')}     ${trace.snapshots.length}`);
      console.log(`  ${theme.dim('Final FP:')} ${trace.finalFingerprint}`);
      console.log('');

      for (const snap of trace.snapshots) {
        const triggerColor = snap.trigger === 'tool_call' ? theme.highlight
          : snap.trigger === 'tool_result' ? theme.success
          : snap.trigger === 'user_message' ? theme.brand
          : theme.dim;

        console.log(
          `  ${theme.dim(`#${String(snap.step).padStart(3, ' ')}`)} ` +
          `${triggerColor(snap.trigger.padEnd(20))} ` +
          `${snap.toolName ? theme.highlight(snap.toolName.padEnd(16)) : ''.padEnd(16)} ` +
          `${theme.dim('fp:')}${snap.fingerprint.slice(0, 8)} ` +
          `${theme.dim('msgs:')}${snap.messageCount} ` +
          `${theme.dim('~')}${snap.tokenEstimate}${theme.dim('tok')}`
        );
      }

      console.log(divider());
    } catch (err) {
      console.log(theme.error(` Failed to read trace: ${err instanceof Error ? err.message : String(err)}`));
    }
  });

runsCommand
  .command('replay <id>')
  .description('Replay a run with a different model')
  .option('--model <model>', 'Model to replay with')
  .option('--provider <provider>', 'Provider to replay with')
  .option('--dry-run', 'Show the task without executing')
  .action(async (id: string, opts: { model?: string; provider?: string; dryRun?: boolean }) => {
    const cwd = process.cwd();

    if (!isInitialized(cwd)) {
      console.log(theme.error(' Rivet is not initialized. Run `rivet init` first.'));
      process.exit(1);
    }

    const run = RunLogger.getRunById(cwd, id);
    if (!run) {
      console.log(theme.error(` Run not found: ${id}`));
      return;
    }

    const config = loadConfig(cwd);
    if (opts.model) config.model = opts.model;
    if (opts.provider) config.provider = opts.provider;

    console.log('');
    console.log(theme.bold(' Replaying Run'));
    console.log(divider());
    console.log(`  ${theme.dim('Original:')}  ${run.id.slice(0, 8)} (${run.provider}/${run.model})`);
    console.log(`  ${theme.dim('Replay:')}    ${config.provider}/${config.model}`);
    console.log(`  ${theme.dim('Task:')}      ${run.task}`);
    console.log(divider());
    console.log('');

    if (opts.dryRun) {
      console.log(theme.warning(' [DRY RUN] Would replay the task above with the new model.'));
      return;
    }

    const provider = createProvider(config, cwd);
    const handler = new TerminalApprovalHandler();
    const perms = loadPermissions(cwd);

    const agent = new AgentLoop({
      provider,
      handler,
      workspaceRoot: cwd,
      buildCommand: config.build_command,
    });

    agent.startRun(`replay:${run.id.slice(0, 8)}`, config.provider, config.model);

    try {
      const result = await agent.runTask(run.task);
      agent.completeRun(result);
      console.log('');
      console.log(theme.success(' Replay completed.'));
      console.log(theme.dim(' Compare with: rivet runs diff <original-id> <replay-id>'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      agent.failRun(msg);
      console.log(theme.error(` Replay failed: ${msg}`));
      process.exit(1);
    }
  });
