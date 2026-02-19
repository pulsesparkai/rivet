import { Command } from 'commander';
import { initRivet, loadPermissions } from '@pulsesparkai/core';
import { loadConfig } from '@pulsesparkai/providers';
import { theme, bootScreen, statusBar, divider } from '../ui/theme';
import type { BootContext } from '../ui/theme';

export const initCommand = new Command('init')
  .description('Initialize Rivet in the current directory')
  .action(() => {
    const cwd = process.env.INIT_CWD ?? process.cwd();
    const result = initRivet(cwd);

    const config = loadConfig(cwd);
    const perms = loadPermissions(cwd);

    const ctx: BootContext = {
      provider: config.provider,
      model: config.model,
      workspace: cwd,
      writeEnabled: perms.write_file,
      commandsEnabled: perms.run_command,
      demoMode: config.provider === 'demo',
    };

    console.log(bootScreen(ctx));

    if (result.created.length > 0) {
      console.log(theme.success('  Initialized Rivet workspace:'));
      for (const f of result.created) {
        console.log(theme.success(`    + ${f}`));
      }
    }

    if (result.existed.length > 0) {
      console.log(theme.dim('  Already existed:'));
      for (const f of result.existed) {
        console.log(theme.dim(`    ~ ${f}`));
      }
    }

    console.log('');
    process.stdout.write(statusBar(ctx));

    console.log('');
    console.log(theme.bold('  Next steps'));
    console.log(divider());
    const envVar = config.api_key_env || 'RIVET_API_KEY';
    console.log(`  1. Set your API key:  ${theme.highlight(`export ${envVar}=<your-key>`)}`);
    console.log(`  2. Start chatting:    ${theme.highlight('rivet chat')}`);
    console.log(`  3. Or run a task:     ${theme.highlight('rivet run "describe this project"')}`);
    console.log(`  4. Permissions:       ${theme.highlight('rivet permissions')}`);
    console.log(`  5. Self-test:         ${theme.highlight('rivet doctor')}`);
    console.log('');
  });
