import chalk from 'chalk';
import * as path from 'path';

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

const RIVET_ASCII = [
  ' ██████╗ ██╗██╗   ██╗███████╗████████╗',
  ' ██╔══██╗██║██║   ██║██╔════╝╚══██╔══╝',
  ' ██████╔╝██║██║   ██║█████╗     ██║   ',
  ' ██╔══██╗██║╚██╗ ██╔╝██╔══╝     ██║   ',
  ' ██║  ██║██║ ╚████╔╝ ███████╗   ██║   ',
  ' ╚═╝  ╚═╝╚═╝  ╚═══╝  ╚══════╝   ╚═╝   ',
];

export interface BootContext {
  provider: string;
  model: string;
  workspace: string;
  writeEnabled: boolean;
  commandsEnabled: boolean;
  dryRun?: boolean;
}

export function bootScreen(ctx: BootContext): string {
  const w = 54;
  const bar = theme.dim('─'.repeat(w));

  const logo = RIVET_ASCII.map((l) => theme.brand(l)).join('\n');

  const permMode = ctx.dryRun
    ? theme.dim('DRY-RUN')
    : !ctx.writeEnabled && !ctx.commandsEnabled
    ? theme.dim('READ-ONLY')
    : ctx.writeEnabled && ctx.commandsEnabled
    ? theme.success('WRITE + COMMANDS ENABLED')
    : ctx.writeEnabled
    ? theme.warning('WRITE ENABLED')
    : theme.warning('COMMANDS ENABLED');

  const truncWorkspace = ctx.workspace.length > 44
    ? '...' + ctx.workspace.slice(-41)
    : ctx.workspace;

  const lines = [
    '',
    logo,
    '',
    theme.dim('  by PulseSpark.ai') + '  ' + theme.dim('v0.1.0'),
    bar,
    `  ${theme.bold('Provider')}   ${theme.highlight(ctx.provider)} ${theme.dim('|')} ${theme.bold('Model')} ${theme.highlight(ctx.model)}`,
    `  ${theme.bold('Workspace')}  ${theme.muted(truncWorkspace)}`,
    `  ${theme.bold('Perms')}      ${permMode}`,
    `  ${theme.bold('Logs')}       ${theme.dim(path.join('.rivet', 'runs') + '/')}`,
    bar,
    '',
  ];

  return lines.join('\n');
}

export function statusBar(ctx: BootContext): string {
  const permMode = ctx.dryRun
    ? theme.dim('[dry-run]')
    : !ctx.writeEnabled && !ctx.commandsEnabled
    ? theme.dim('[read-only]')
    : ctx.writeEnabled && ctx.commandsEnabled
    ? theme.success('[write+cmd]')
    : ctx.writeEnabled
    ? theme.warning('[write]')
    : theme.warning('[cmd]');

  return (
    theme.dim('─'.repeat(54)) +
    '\n' +
    theme.dim('  ') +
    theme.brand('rivet') +
    theme.dim('  ') +
    theme.highlight(ctx.provider) +
    theme.dim('/') +
    theme.muted(ctx.model) +
    '  ' +
    permMode +
    '\n'
  );
}

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
  return theme.dim('─'.repeat(54));
}
