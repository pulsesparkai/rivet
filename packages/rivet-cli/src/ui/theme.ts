import chalk from 'chalk';

export const theme = {
  brand: chalk.hex('#0ea5e9'),
  brandBold: chalk.hex('#0ea5e9').bold,
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  dim: chalk.dim,
  bold: chalk.bold,
  muted: chalk.gray,
  highlight: chalk.cyan,
  danger: chalk.redBright.bold,
};

export function banner(): string {
  return [
    '',
    theme.brand('  ╔══════════════════════════════════════╗'),
    theme.brand('  ║') + theme.brandBold('   Rivet') + theme.dim(' by PulseSpark.ai') + theme.brand('           ║'),
    theme.brand('  ║') + theme.dim('   Agentic workflows from your terminal') + theme.brand(' ║'),
    theme.brand('  ╚══════════════════════════════════════╝'),
    '',
  ].join('\n');
}

export function divider(): string {
  return theme.dim('─'.repeat(50));
}
