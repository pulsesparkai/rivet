"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logsCommand = void 0;
const commander_1 = require("commander");
const core_1 = require("@pulsespark/core");
const shared_1 = require("@pulsespark/shared");
const theme_1 = require("../ui/theme");
exports.logsCommand = new commander_1.Command('logs')
    .description('View run logs')
    .argument('[id]', 'Run ID to view details')
    .option('-n, --limit <number>', 'Number of recent runs to show', '10')
    .action((id, opts) => {
    const cwd = process.cwd();
    if (id) {
        showRunDetail(cwd, id);
    }
    else {
        listRuns(cwd, parseInt(opts?.limit || '10', 10));
    }
});
function listRuns(cwd, limit) {
    const runs = core_1.RunLogger.listRuns(cwd).slice(0, limit);
    if (runs.length === 0) {
        console.log(theme_1.theme.dim(' No runs found. Use `rivet run` or `rivet chat` first.'));
        return;
    }
    console.log(theme_1.theme.bold(' Recent Runs:'));
    console.log((0, theme_1.divider)());
    for (const run of runs) {
        const statusColors = {
            running: theme_1.theme.warning,
            completed: theme_1.theme.success,
            failed: theme_1.theme.error,
            cancelled: theme_1.theme.dim,
        };
        const statusFn = statusColors[run.status];
        console.log(`  ${theme_1.theme.dim(run.id.slice(0, 8))} ${(0, shared_1.formatTimestamp)(run.timestamp)} ${statusFn(run.status.padEnd(10))} ${(0, shared_1.truncate)(run.task, 40)}`);
    }
    console.log((0, theme_1.divider)());
    console.log(theme_1.theme.dim(` Use \`rivet logs <id>\` for details.`));
}
function showRunDetail(cwd, id) {
    const run = core_1.RunLogger.getRunById(cwd, id);
    if (!run) {
        console.log(theme_1.theme.error(` Run not found: ${id}`));
        return;
    }
    console.log(theme_1.theme.bold(` Run: ${run.id}`));
    console.log((0, theme_1.divider)());
    console.log(`  ${theme_1.theme.bold('Task:')}      ${run.task}`);
    console.log(`  ${theme_1.theme.bold('Provider:')}  ${run.provider}`);
    console.log(`  ${theme_1.theme.bold('Model:')}     ${run.model}`);
    console.log(`  ${theme_1.theme.bold('Status:')}    ${run.status}`);
    console.log(`  ${theme_1.theme.bold('Time:')}      ${(0, shared_1.formatTimestamp)(run.timestamp)}`);
    if (run.plan) {
        console.log('');
        console.log(theme_1.theme.bold('  Plan:'));
        for (const line of run.plan.split('\n')) {
            console.log(`    ${line}`);
        }
    }
    if (run.actions.length > 0) {
        console.log('');
        console.log(theme_1.theme.bold(`  Actions (${run.actions.length}):`));
        for (const action of run.actions) {
            const time = (0, shared_1.formatTimestamp)(action.timestamp);
            console.log(`    ${theme_1.theme.dim(time)} ${theme_1.theme.highlight(action.type)} ${JSON.stringify(action.data).slice(0, 80)}`);
        }
    }
    if (run.summary) {
        console.log('');
        console.log(theme_1.theme.bold('  Summary:'));
        console.log(`    ${run.summary}`);
    }
    console.log((0, theme_1.divider)());
}
