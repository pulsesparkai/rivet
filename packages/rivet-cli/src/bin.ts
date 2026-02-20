#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { initCommand } from './commands/init';
import { chatCommand } from './commands/chat';
import { runCommand } from './commands/run';
import { logsCommand } from './commands/logs';
import { configCommand } from './commands/config';
import { doctorCommand } from './commands/doctor';
import { demoCommand } from './commands/demo';
import { permissionsCommand } from './commands/permissions';
import { soulCommand } from './commands/soul';
import { dashboardCommand } from './commands/dashboard';
import { runsCommand } from './commands/runs';
import { secretsCommand } from './commands/secrets';
import { workflowCommand } from './commands/workflow';

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version: string };

const program = new Command();

program
  .name('rivet')
  .description('Rivet by PulseSpark AI - Agentic workflows from your terminal')
  .version(pkg.version);

program.addCommand(initCommand);
program.addCommand(chatCommand);
program.addCommand(runCommand);
program.addCommand(logsCommand);
program.addCommand(configCommand);
program.addCommand(doctorCommand);
program.addCommand(demoCommand);
program.addCommand(permissionsCommand);
program.addCommand(soulCommand);
program.addCommand(dashboardCommand);
program.addCommand(runsCommand);
program.addCommand(secretsCommand);
program.addCommand(workflowCommand);

program.parse(process.argv);
