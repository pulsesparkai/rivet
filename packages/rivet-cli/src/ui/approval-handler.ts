import * as readline from 'readline';
import chalk from 'chalk';
import { ProposedAction } from '@pulsespark/shared';
import { ApprovalHandler } from '@pulsespark/core';
import { theme, divider } from './theme';

const alwaysAllowedTools = new Set<string>();

function renderCard(lines: string[]): void {
  const w = 54;
  console.log('');
  console.log(theme.warning('┌' + '─'.repeat(w - 2) + '┐'));
  for (const line of lines) {
    const stripped = line.replace(/\x1B\[[0-9;]*m/g, '');
    const pad = Math.max(0, w - 4 - stripped.length);
    console.log(theme.warning('│') + '  ' + line + ' '.repeat(pad) + '  ' + theme.warning('│'));
  }
  console.log(theme.warning('└' + '─'.repeat(w - 2) + '┘'));
}

export class TerminalApprovalHandler implements ApprovalHandler {
  async requestApproval(action: ProposedAction, diff?: string): Promise<boolean> {
    if (alwaysAllowedTools.has(action.tool)) {
      return true;
    }

    const riskColors: Record<'low' | 'medium' | 'high', (s: string) => string> = {
      low: theme.success,
      medium: theme.warning,
      high: theme.danger,
    };
    const riskLabel = riskColors[action.risk](`${action.risk.toUpperCase()}`);

    const typeLabel =
      action.tool === 'write_file' ? chalk.cyan('WRITE FILE') :
      action.tool === 'run_command' ? chalk.redBright('RUN COMMAND') :
      chalk.yellow(action.tool.toUpperCase());

    const cardLines = [
      `${theme.bold('ACTION')}  ${typeLabel}   ${theme.bold('RISK')} ${riskLabel}`,
      theme.dim('─'.repeat(48)),
      `${theme.dim('desc')}    ${action.description}`,
    ];

    if (action.tool === 'run_command') {
      cardLines.push(`${theme.dim('cmd')}     ${theme.highlight(String(action.args.command))}`);
    }

    if (action.tool === 'write_file') {
      cardLines.push(`${theme.dim('path')}    ${theme.muted(String(action.args.path))}`);
    }

    renderCard(cardLines);

    if (diff) {
      console.log('');
      console.log(theme.bold('  Diff:'));
      const diffLines = diff.split('\n').slice(0, 30);
      for (const line of diffLines) {
        if (line.startsWith('+++') || line.startsWith('---')) {
          console.log(`  ${theme.dim(line)}`);
        } else if (line.startsWith('+')) {
          console.log(`  ${chalk.green(line)}`);
        } else if (line.startsWith('-')) {
          console.log(`  ${chalk.red(line)}`);
        } else if (line.startsWith('@@')) {
          console.log(`  ${chalk.cyan(line)}`);
        } else {
          console.log(`  ${theme.dim(line)}`);
        }
      }
      if (diff.split('\n').length > 30) {
        console.log(theme.dim(`  ... (${diff.split('\n').length - 30} more lines)`));
      }
    }

    console.log('');
    console.log(theme.dim('  [y] approve  [n] deny  [a] always allow  [s] skip all'));

    const answer = await askKey();

    if (answer === 'a') {
      alwaysAllowedTools.add(action.tool);
      console.log(theme.success(`  Always allowing: ${action.tool}`));
      return true;
    }

    if (answer === 'y') {
      return true;
    }

    console.log(theme.dim('  Denied.'));
    return false;
  }

  showPlan(plan: string): void {
    console.log('');
    console.log(theme.brandBold('  Plan:'));
    console.log(divider());
    for (const line of plan.split('\n')) {
      console.log(`  ${line}`);
    }
    console.log(divider());
    console.log('');
  }

  showMessage(role: string, content: string): void {
    if (role === 'assistant') {
      console.log('');
      console.log(theme.brand('  Rivet'));
      console.log(theme.dim('  ' + '─'.repeat(40)));
      for (const line of content.split('\n')) {
        console.log(`  ${line}`);
      }
      console.log('');
    }
  }

  showToolResult(name: string, output: string, error?: string): void {
    if (error) {
      console.log(theme.error(`  [${name}] ${error}`));
      console.log(theme.dim('  Run with --debug for full details.'));
    } else if (output) {
      const lines = output.split('\n');
      const preview = lines.slice(0, 12).join('\n');
      console.log(theme.dim(`  [${name}]`));
      for (const l of preview.split('\n')) {
        console.log(theme.dim(`    ${l}`));
      }
      if (lines.length > 12) {
        console.log(theme.dim(`    ... (${lines.length - 12} more lines)`));
      }
    }
  }
}

function askKey(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() || 'n');
    });
  });
}
