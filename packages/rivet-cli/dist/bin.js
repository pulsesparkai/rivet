#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const init_1 = require("./commands/init");
const chat_1 = require("./commands/chat");
const run_1 = require("./commands/run");
const logs_1 = require("./commands/logs");
const config_1 = require("./commands/config");
const program = new commander_1.Command();
program
    .name('rivet')
    .description('Rivet by PulseSpark.ai - Agentic workflows from your terminal')
    .version('0.1.0');
program.addCommand(init_1.initCommand);
program.addCommand(chat_1.chatCommand);
program.addCommand(run_1.runCommand);
program.addCommand(logs_1.logsCommand);
program.addCommand(config_1.configCommand);
program.parse(process.argv);
