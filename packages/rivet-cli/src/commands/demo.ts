import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { isInitialized, initRivet } from '@pulsesparkai/core';
import { theme, bootScreen, statusBar, divider } from '../ui/theme';
import type { BootContext } from '../ui/theme';

const DEMO_PLAN = `Goal: Explore this project and propose a small improvement.

Steps:
  1. List the project root to understand structure.
  2. Read README.md (or package.json) to learn about the project.
  3. Propose a one-line edit to improve documentation.

Approvals required:
  - Step 3: write_file requires your approval (diff preview shown).`;

const DEMO_DIFF = `--- a/README.md
+++ b/README.md
@@ -1,3 +1,4 @@
 # Project
+
+> Built with Rivet by PulseSpark AI

 A brief description of this project.`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function typeText(text: string, delayMs = 18): Promise<void> {
  for (const char of text) {
    process.stdout.write(char);
    await sleep(delayMs);
  }
  process.stdout.write('\n');
}

export const demoCommand = new Command('demo')
  .description('Run a scripted 20-second demo showcasing Rivet capabilities')
  .action(async () => {
    const cwd = process.env.INIT_CWD ?? process.cwd();

    if (!isInitialized(cwd)) {
      initRivet(cwd);
    }

    const ctx: BootContext = {
      provider: 'demo',
      model: 'scripted',
      workspace: cwd,
      writeEnabled: false,
      commandsEnabled: false,
      demoMode: true,
    };

    console.log(bootScreen(ctx));
    await sleep(600);

    process.stdout.write(statusBar(ctx));
    await sleep(400);

    console.log(theme.brand('  Rivet'));
    console.log(theme.dim('  ' + '─'.repeat(40)));
    await typeText('  Planning your task...', 30);
    await sleep(500);

    console.log('');
    console.log(theme.brandBold('  Plan:'));
    console.log(divider());
    for (const line of DEMO_PLAN.split('\n')) {
      console.log(`  ${line}`);
      await sleep(80);
    }
    console.log(divider());
    await sleep(600);

    console.log('');
    console.log(theme.dim('  [list_dir]'));
    const entries = listDirSafe(cwd);
    for (const entry of entries.slice(0, 10)) {
      console.log(theme.dim(`    ${entry}`));
      await sleep(40);
    }
    if (entries.length > 10) {
      console.log(theme.dim(`    ... (${entries.length - 10} more)`));
    }
    await sleep(500);

    console.log('');
    const readmeContent = readFileSafe(cwd);
    console.log(theme.dim('  [read_file] README.md'));
    const previewLines = readmeContent.split('\n').slice(0, 8);
    for (const line of previewLines) {
      console.log(theme.dim(`    ${line}`));
      await sleep(30);
    }
    if (readmeContent.split('\n').length > 8) {
      console.log(theme.dim(`    ... (${readmeContent.split('\n').length - 8} more lines)`));
    }
    await sleep(600);

    console.log('');
    const w = 54;
    console.log(theme.warning('┌' + '─'.repeat(w - 2) + '┐'));
    const cardLines = [
      `${theme.bold('ACTION')}  WRITE FILE   ${theme.bold('RISK')} ${theme.warning('MEDIUM')}`,
      theme.dim('─'.repeat(48)),
      `${theme.dim('desc')}    Propose documentation improvement`,
      `${theme.dim('path')}    ${theme.muted('README.md')}`,
    ];
    for (const line of cardLines) {
      const stripped = line.replace(/\x1B\[[0-9;]*m/g, '');
      const pad = Math.max(0, w - 4 - stripped.length);
      console.log(theme.warning('│') + '  ' + line + ' '.repeat(pad) + '  ' + theme.warning('│'));
    }
    console.log(theme.warning('└' + '─'.repeat(w - 2) + '┘'));
    await sleep(300);

    console.log('');
    console.log(theme.bold('  Diff:'));
    for (const line of DEMO_DIFF.split('\n')) {
      if (line.startsWith('+++') || line.startsWith('---')) {
        console.log(`  ${theme.dim(line)}`);
      } else if (line.startsWith('+')) {
        console.log(`  ${theme.success(line)}`);
      } else if (line.startsWith('-')) {
        console.log(`  ${theme.error(line)}`);
      } else if (line.startsWith('@@')) {
        console.log(`  ${theme.highlight(line)}`);
      } else {
        console.log(`  ${theme.dim(line)}`);
      }
      await sleep(50);
    }

    console.log('');
    console.log(theme.dim('  [y] approve  [n] deny  [a] always allow  [s] skip all'));
    await sleep(800);

    console.log('');
    console.log(theme.dim('  (demo) Action skipped — no changes applied.'));
    await sleep(400);

    console.log('');
    console.log(divider());
    console.log('');
    console.log(theme.brandBold('  That was Rivet.'));
    console.log(theme.dim('  Reads, plans, shows diffs, asks before writing. All local.'));
    console.log('');
    console.log(`  Try: ${theme.highlight('rivet chat')}`);
    console.log('');
  });

function listDirSafe(cwd: string): string[] {
  try {
    return fs.readdirSync(cwd).sort();
  } catch {
    return ['src/', 'package.json', 'README.md', 'node_modules/'];
  }
}

function readFileSafe(cwd: string): string {
  const candidates = ['README.md', 'README', 'readme.md', 'package.json'];
  for (const name of candidates) {
    const p = path.join(cwd, name);
    try {
      return fs.readFileSync(p, 'utf-8');
    } catch {
      continue;
    }
  }
  return '# Project\n\nA brief description of this project.\n';
}
