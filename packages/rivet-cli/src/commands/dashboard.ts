import { Command } from 'commander';
import { isInitialized, initRivet } from '@pulsesparkai/core';
import { theme } from '../ui/theme';
import { startServer } from '../server/index';

export const dashboardCommand = new Command('dashboard')
  .alias('dash')
  .description('Launch the local Rivet dashboard in your browser')
  .option('-p, --port <port>', 'Port to run on', '4800')
  .option('--no-open', 'Do not auto-open browser')
  .action(async (opts) => {
    const cwd = process.env.INIT_CWD ?? process.cwd();

    if (!isInitialized(cwd)) {
      console.log(theme.dim('  No .rivet/ found. Initializing...'));
      initRivet(cwd);
    }

    const port = parseInt(opts.port, 10) || 4800;
    const open = opts.open !== false;

    console.log('');
    console.log(theme.brand('  ▌ Rivet Dashboard'));
    console.log(theme.dim('  ─'.repeat(27)));
    console.log(`  ${theme.bold('URL')}        ${theme.highlight(`http://localhost:${port}`)}`);
    console.log(`  ${theme.bold('Workspace')}  ${theme.muted(cwd)}`);
    console.log(theme.dim('  ─'.repeat(27)));
    console.log('');
    console.log(theme.dim('  Press Ctrl+C to stop'));
    console.log('');

    await startServer({ port, workspaceRoot: cwd, openBrowser: open });
  });
