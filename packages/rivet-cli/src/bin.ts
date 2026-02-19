#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { chatCommand } from './commands/chat';
import { runCommand } from './commands/run';
import { logsCommand } from './commands/logs';
import { configCommand } from './commands/config';

const program = new Command();

program
  .name('rivet')
  .description('Rivet by PulseSpark.ai - Agentic workflows from your terminal')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(chatCommand);
program.addCommand(runCommand);
program.addCommand(logsCommand);
program.addCommand(configCommand);

program.parse(process.argv);
