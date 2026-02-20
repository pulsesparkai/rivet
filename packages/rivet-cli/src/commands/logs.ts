import { Command } from 'commander';
import { RunLogger } from '@pulsesparkai/core';
import { RunLog, formatTimestamp, truncate } from '@pulsesparkai/shared';
import { theme, divider } from '../ui/theme';

export const logsCommand = new Command('logs')
  .description('View run logs')
  .argument('[id]', 'Run ID to view details')
  .option('-n, --limit <number>', 'Number of recent runs to show', '10')
  .action((id?: string, opts?: { limit: string }) => {
    const cwd = process.cwd();

    if (id) {
      showRunDetail(cwd, id);
    } else {
      listRuns(cwd, parseInt(opts?.limit || '10', 10));
    }
  });

function listRuns(cwd: string, limit: number): void {
  const runs = RunLogger.listRuns(cwd).slice(0, limit);

  if (runs.length === 0) {
    console.log(theme.dim(' No runs found. Use `rivet run` or `rivet chat` first.'));
    return;
  }

  console.log(theme.bold(' Recent Runs:'));
  console.log(divider());

  for (const run of runs) {
    const statusColors: Record<RunLog['status'], (s: string) => string> = {
      running: theme.warning,
      completed: theme.success,
      failed: theme.error,
      cancelled: theme.dim,
    };
    const statusFn = statusColors[run.status];

    console.log(
      `  ${theme.dim(run.id.slice(0, 8))} ${formatTimestamp(run.timestamp)} ${statusFn(run.status.padEnd(10))} ${truncate(run.task, 40)}`
    );
  }

  console.log(divider());
  console.log(theme.dim(` Use \`rivet logs <id>\` for details.`));
}

function showRunDetail(cwd: string, id: string): void {
  const run = RunLogger.getRunById(cwd, id);

  if (!run) {
    console.log(theme.error(` Run not found: ${id}`));
    return;
  }

  console.log(theme.bold(` Run: ${run.id}`));
  console.log(divider());
  console.log(`  ${theme.bold('Task:')}      ${run.task}`);
  console.log(`  ${theme.bold('Provider:')}  ${run.provider}`);
  console.log(`  ${theme.bold('Model:')}     ${run.model}`);
  console.log(`  ${theme.bold('Status:')}    ${run.status}`);
  console.log(`  ${theme.bold('Time:')}      ${formatTimestamp(run.timestamp)}`);

  if (run.plan) {
    console.log('');
    console.log(theme.bold('  Plan:'));
    for (const line of run.plan.split('\n')) {
      console.log(`    ${line}`);
    }
  }

  if (run.actions.length > 0) {
    console.log('');
    console.log(theme.bold(`  Actions (${run.actions.length}):`));
    for (const action of run.actions) {
      const time = formatTimestamp(action.timestamp);
      console.log(`    ${theme.dim(time)} ${theme.highlight(action.type)} ${JSON.stringify(action.data).slice(0, 80)}`);
    }
  }

  if (run.summary) {
    console.log('');
    console.log(theme.bold('  Summary:'));
    console.log(`    ${run.summary}`);
  }

  console.log(divider());
}
