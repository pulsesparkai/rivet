import { Command } from 'commander';
import * as readline from 'readline';
import { execSync } from 'child_process';
import { isInitialized, hasSoul, createSoul, loadSoul, soulPath } from '@pulsesparkai/core';
import { containsSecrets } from '@pulsesparkai/shared';
import { theme, divider } from '../ui/theme';

function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function tryOpenEditor(filePath: string): boolean {
  const editor = process.env.EDITOR || process.env.VISUAL;
  if (!editor) return false;
  try {
    execSync(`${editor} "${filePath}"`, { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

export const soulCommand = new Command('soul')
  .description('View or create your Rivet Soul (local preferences)')
  .action(async () => {
    const cwd = process.env.INIT_CWD ?? process.cwd();

    if (!isInitialized(cwd)) {
      console.log(theme.error('  Rivet is not initialized. Run `rivet init` first.'));
      process.exit(1);
    }

    if (hasSoul(cwd)) {
      const p = soulPath(cwd);
      const raw = loadSoul(cwd);

      console.log('');
      console.log(theme.bold('  Rivet Soul'));
      console.log(divider());
      console.log(`  ${theme.dim('Path:')} ${theme.highlight(p)}`);
      console.log('');

      if (raw && containsSecrets(raw)) {
        console.log(theme.warning('  WARNING: This file contains what looks like secrets.'));
        console.log(theme.warning('  Do not store secrets here. They will be redacted before sending to the LLM.'));
        console.log('');
      }

      if (raw) {
        const lines = raw.split('\n').slice(0, 30);
        for (const line of lines) {
          console.log(theme.dim(`  ${line}`));
        }
        if (raw.split('\n').length > 30) {
          console.log(theme.dim(`  ... (${raw.split('\n').length - 30} more lines)`));
        }
      }

      console.log('');
      console.log(theme.dim('  Do not store secrets here.'));
      console.log('');

      const answer = await ask(theme.brand('  Open in $EDITOR? [y/N] '));
      if (answer.toLowerCase() === 'y') {
        if (!tryOpenEditor(p)) {
          console.log(theme.dim('  $EDITOR is not set. Edit the file manually:'));
          console.log(`  ${theme.highlight(p)}`);
        }
      }
      return;
    }

    console.log('');
    console.log(theme.bold('  Rivet Soul'));
    console.log(divider());
    console.log(theme.dim('  No soul.md found. This is a local preference file that helps'));
    console.log(theme.dim('  Rivet match how you work (tone, conventions, success criteria).'));
    console.log('');

    const answer = await ask(theme.brand('  Create .rivet/soul.md? [Y/n] '));
    if (answer.toLowerCase() === 'n') {
      console.log(theme.dim('  Skipped.'));
      return;
    }

    const p = createSoul(cwd);
    console.log(theme.success(`  Created: ${p}`));
    console.log('');

    if (!tryOpenEditor(p)) {
      console.log(theme.dim('  $EDITOR is not set. Edit the file manually:'));
      console.log(`  ${theme.highlight(p)}`);
    }
    console.log('');
  });
