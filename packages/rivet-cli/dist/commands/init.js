"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = void 0;
const commander_1 = require("commander");
const core_1 = require("@pulsespark/core");
const theme_1 = require("../ui/theme");
exports.initCommand = new commander_1.Command('init')
    .description('Initialize Rivet in the current directory')
    .action(() => {
    console.log((0, theme_1.banner)());
    const cwd = process.cwd();
    const result = (0, core_1.initRivet)(cwd);
    if (result.created.length > 0) {
        console.log(theme_1.theme.success(' Initialized Rivet workspace:'));
        for (const f of result.created) {
            console.log(theme_1.theme.success(`   + ${f}`));
        }
    }
    if (result.existed.length > 0) {
        console.log(theme_1.theme.dim(' Already existed:'));
        for (const f of result.existed) {
            console.log(theme_1.theme.dim(`   ~ ${f}`));
        }
    }
    console.log('');
    console.log(theme_1.theme.bold(' Next steps:'));
    console.log(`  1. Set your API key: ${theme_1.theme.highlight('export OPENAI_API_KEY=sk-...')}`);
    console.log(`  2. Start chatting:   ${theme_1.theme.highlight('rivet chat')}`);
    console.log(`  3. Or run a task:    ${theme_1.theme.highlight('rivet run "describe this project"')}`);
    console.log('');
});
