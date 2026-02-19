import inquirer from 'inquirer';
import chalk from 'chalk';
import { ProposedAction } from '@pulsespark/shared';
import { ApprovalHandler } from '@pulsespark/core';
import { theme, divider } from './theme';

export class TerminalApprovalHandler implements ApprovalHandler {
  async requestApproval(action: ProposedAction, diff?: string): Promise<boolean> {
    console.log('');
    console.log(divider());
    console.log(theme.warning(' APPROVAL REQUIRED'));
    console.log('');

    const riskColors: Record<'low' | 'medium' | 'high', (s: string) => string> = {
      low: theme.success,
      medium: theme.warning,
      high: theme.danger,
    };
    const riskLabel = riskColors[action.risk](`[${action.risk.toUpperCase()}]`);

    console.log(`  ${theme.bold('Action:')} ${action.description}`);
    console.log(`  ${theme.bold('Tool:')}   ${action.tool}`);
    console.log(`  ${theme.bold('Risk:')}   ${riskLabel}`);

    if (diff) {
      console.log('');
      console.log(theme.bold('  Diff:'));
      for (const line of diff.split('\n')) {
        if (line.startsWith('+')) {
          console.log(`  ${chalk.green(line)}`);
        } else if (line.startsWith('-')) {
          console.log(`  ${chalk.red(line)}`);
        } else {
          console.log(`  ${theme.dim(line)}`);
        }
      }
    }

    if (action.tool === 'run_command') {
      console.log('');
      console.log(`  ${theme.bold('Command:')} ${theme.highlight(String(action.args.command))}`);
    }

    console.log(divider());

    const { approved } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'approved',
        message: 'Approve this action?',
        default: false,
      },
    ]);

    return approved;
  }

  showPlan(plan: string): void {
    console.log('');
    console.log(theme.brandBold(' Plan:'));
    console.log(theme.dim('─'.repeat(40)));
    for (const line of plan.split('\n')) {
      console.log(`  ${line}`);
    }
    console.log(theme.dim('─'.repeat(40)));
    console.log('');
  }

  showMessage(role: string, content: string): void {
    if (role === 'assistant') {
      console.log('');
      console.log(theme.brand(' Rivet:'));
      for (const line of content.split('\n')) {
        console.log(`  ${line}`);
      }
      console.log('');
    }
  }

  showToolResult(name: string, output: string, error?: string): void {
    if (error) {
      console.log(theme.error(`  [${name}] Error: ${error}`));
    } else if (output) {
      const lines = output.split('\n');
      const preview = lines.slice(0, 10).join('\n');
      console.log(theme.dim(`  [${name}] ${preview}`));
      if (lines.length > 10) {
        console.log(theme.dim(`  ... (${lines.length - 10} more lines)`));
      }
    }
  }
}
