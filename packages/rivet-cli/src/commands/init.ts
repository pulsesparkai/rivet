import { Command } from 'commander';
import { initRivet } from '@pulsespark/core';
import { theme, banner } from '../ui/theme';

export const initCommand = new Command('init')
  .description('Initialize Rivet in the current directory')
  .action(() => {
    console.log(banner());

    const cwd = process.cwd();
    const result = initRivet(cwd);

    if (result.created.length > 0) {
      console.log(theme.success(' Initialized Rivet workspace:'));
      for (const f of result.created) {
        console.log(theme.success(`   + ${f}`));
      }
    }

    if (result.existed.length > 0) {
      console.log(theme.dim(' Already existed:'));
      for (const f of result.existed) {
        console.log(theme.dim(`   ~ ${f}`));
      }
    }

    console.log('');
    console.log(theme.bold(' Next steps:'));
    console.log(`  1. Set your API key: ${theme.highlight('export RIVET_API_KEY=sk-...')}`);
    console.log(`  2. Start chatting:   ${theme.highlight('rivet chat')}`);
    console.log(`  3. Or run a task:    ${theme.highlight('rivet run "describe this project"')}`);
    console.log('');
  });
