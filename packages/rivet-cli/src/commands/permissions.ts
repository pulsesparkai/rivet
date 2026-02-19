import { Command } from 'commander';
import * as readline from 'readline';
import { isInitialized, loadPermissions, savePermissions } from '@pulsesparkai/core';
import { loadConfig } from '@pulsesparkai/providers';
import { DEFAULT_PERMISSIONS } from '@pulsesparkai/shared';
import type { PermissionsConfig } from '@pulsesparkai/shared';
import { theme, bootScreen, divider } from '../ui/theme';
import type { BootContext } from '../ui/theme';

function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function currentModeName(perms: PermissionsConfig, dryRun?: boolean): string {
  if (dryRun) return 'DRY-RUN';
  if (!perms.write_file && !perms.run_command) return 'READ-ONLY';
  if (perms.write_file && perms.run_command) return 'WRITE + COMMANDS';
  if (perms.write_file) return 'WRITE';
  return 'COMMANDS';
}

function coloredMode(name: string): string {
  switch (name) {
    case 'READ-ONLY': return theme.dim(name);
    case 'WRITE': return theme.warning(name);
    case 'WRITE + COMMANDS': return theme.danger(name);
    case 'DRY-RUN': return theme.highlight(name);
    default: return theme.dim(name);
  }
}

async function confirmSafetyLatch(targetMode: string): Promise<boolean> {
  console.log('');
  console.log(theme.warning('  You are unlocking the safety latch.'));
  console.log(theme.dim('  Writes/commands require approval.'));
  console.log(theme.dim('  Dangerous commands are still blocked.'));
  console.log('');
  const answer = await ask(theme.warning('  Type YES to continue: '));
  if (answer !== 'YES') {
    console.log(theme.dim('  Cancelled. Permissions unchanged.'));
    return false;
  }
  return true;
}

export const permissionsCommand = new Command('permissions')
  .description('View and toggle permission modes (Safety Latch)')
  .action(async () => {
    const cwd = process.env.INIT_CWD ?? process.cwd();

    if (!isInitialized(cwd)) {
      console.log(theme.error('  Rivet is not initialized. Run `rivet init` first.'));
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
      demoMode: config.provider === 'demo',
    };

    console.log(bootScreen(ctx));

    const mode = currentModeName(perms);

    console.log(theme.bold('  Permissions — Safety Latch'));
    console.log(divider());
    console.log(`  Current mode: ${coloredMode(mode)}`);
    console.log('');
    console.log(`  ${theme.highlight('1')}. ${theme.dim('READ-ONLY')} (default)`);
    console.log(theme.dim('     can list_dir, read_file, search_in_files'));
    console.log(theme.dim('     cannot write_file or run_command'));
    console.log('');
    console.log(`  ${theme.highlight('2')}. ${theme.warning('WRITE')} (requires approval)`);
    console.log(theme.dim('     can propose diffs and write_file with approval'));
    console.log(theme.dim('     cannot run_command'));
    console.log('');
    console.log(`  ${theme.highlight('3')}. ${theme.danger('WRITE + COMMANDS')} (requires approval)`);
    console.log(theme.dim('     can write_file and run_command with approval'));
    console.log(theme.dim('     denylist always enforced (rm -rf, sudo, curl|bash, chmod -R, etc.)'));
    console.log('');
    console.log(`  ${theme.highlight('4')}. ${theme.highlight('DRY-RUN')} (plan only)`);
    console.log(theme.dim('     no writes, no commands'));
    console.log(theme.dim('     still shows proposed diffs/commands but never executes'));
    console.log('');
    console.log(`  ${theme.highlight('5')}. Reset to safe defaults`);
    console.log(`  ${theme.highlight('6')}. Back (no changes)`);
    console.log('');

    const answer = await ask(theme.brand('  Select mode (enter number): '));
    const choice = parseInt(answer, 10);

    if (choice === 6 || isNaN(choice) || choice < 1 || choice > 6) {
      console.log(theme.dim('  No changes made.'));
      return;
    }

    if (choice === 5) {
      const defaults = DEFAULT_PERMISSIONS as unknown as PermissionsConfig;
      const resetPerms: PermissionsConfig = {
        ...defaults,
        workspace_root: perms.workspace_root,
        allowed_paths: perms.allowed_paths,
      };
      savePermissions(cwd, resetPerms);
      console.log(theme.success('  Permissions reset to safe defaults (READ-ONLY).'));
      return;
    }

    if (choice === 1) {
      perms.write_file = false;
      perms.run_command = false;
      savePermissions(cwd, perms);
      console.log(theme.success('  Mode set: READ-ONLY'));
      return;
    }

    if (choice === 4) {
      perms.write_file = false;
      perms.run_command = false;
      savePermissions(cwd, perms);
      console.log(theme.success('  Mode set: DRY-RUN'));
      console.log(theme.dim('  Use --dry-run flag with chat/run to enable dry-run mode.'));
      return;
    }

    if (choice === 2) {
      const confirmed = await confirmSafetyLatch('WRITE');
      if (!confirmed) return;
      perms.write_file = true;
      perms.run_command = false;
      perms.require_diff_approval = true;
      savePermissions(cwd, perms);
      console.log(theme.success('  Mode set: WRITE (approval required for every write)'));
      return;
    }

    if (choice === 3) {
      const confirmed = await confirmSafetyLatch('WRITE + COMMANDS');
      if (!confirmed) return;
      perms.write_file = true;
      perms.run_command = true;
      perms.require_diff_approval = true;
      perms.require_approval_for_commands = true;
      savePermissions(cwd, perms);
      console.log(theme.success('  Mode set: WRITE + COMMANDS (approval required, denylist enforced)'));
      return;
    }
  });
