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
  demoMode?: boolean;
}

export function permLabel(ctx: BootContext): string {
  if (ctx.demoMode) return theme.warning('DEMO MODE (no provider key)');
  if (ctx.dryRun) return theme.highlight('DRY-RUN');
  if (!ctx.writeEnabled && !ctx.commandsEnabled) return theme.dim('READ-ONLY');
  if (ctx.writeEnabled && ctx.commandsEnabled) return theme.danger('WRITE + COMMANDS');
  if (ctx.writeEnabled) return theme.warning('WRITE');
  return theme.warning('COMMANDS');
}

export function permTag(ctx: BootContext): string {
  if (ctx.demoMode) return theme.warning('[demo]');
  if (ctx.dryRun) return theme.highlight('[dry-run]');
  if (!ctx.writeEnabled && !ctx.commandsEnabled) return theme.dim('[read-only]');
  if (ctx.writeEnabled && ctx.commandsEnabled) return theme.danger('[write+cmd]');
  if (ctx.writeEnabled) return theme.warning('[write]');
  return theme.warning('[cmd]');
}

export function bootScreen(ctx: BootContext): string {
  const w = 54;
  const bar = theme.dim('─'.repeat(w));

  const logo = RIVET_ASCII.map((l) => theme.brand(l)).join('\n');

  const truncWorkspace = ctx.workspace.length > 44
    ? '...' + ctx.workspace.slice(-41)
    : ctx.workspace;

  const lines = [
    '',
    logo,
    '',
    theme.dim('  by PulseSpark AI') + '  ' + theme.dim('v0.1.0'),
    bar,
    `  ${theme.bold('Provider')}   ${theme.highlight(ctx.provider)} ${theme.dim('|')} ${theme.bold('Model')} ${theme.highlight(ctx.model)}`,
    `  ${theme.bold('Workspace')}  ${theme.muted(truncWorkspace)}`,
    `  ${theme.bold('Perms')}      ${permLabel(ctx)}`,
    `  ${theme.bold('Logs')}       ${theme.dim(path.join('.rivet', 'runs') + '/')}`,
    bar,
    '',
  ];

  return lines.join('\n');
}

export function statusBar(ctx: BootContext): string {
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
    permTag(ctx) +
    '\n'
  );
}

export function divider(): string {
  return theme.dim('─'.repeat(54));
}
