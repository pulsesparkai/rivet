"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalApprovalHandler = void 0;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const theme_1 = require("./theme");
class TerminalApprovalHandler {
    async requestApproval(action, diff) {
        console.log('');
        console.log((0, theme_1.divider)());
        console.log(theme_1.theme.warning(' APPROVAL REQUIRED'));
        console.log('');
        const riskColors = {
            low: theme_1.theme.success,
            medium: theme_1.theme.warning,
            high: theme_1.theme.danger,
        };
        const riskLabel = riskColors[action.risk](`[${action.risk.toUpperCase()}]`);
        console.log(`  ${theme_1.theme.bold('Action:')} ${action.description}`);
        console.log(`  ${theme_1.theme.bold('Tool:')}   ${action.tool}`);
        console.log(`  ${theme_1.theme.bold('Risk:')}   ${riskLabel}`);
        if (diff) {
            console.log('');
            console.log(theme_1.theme.bold('  Diff:'));
            for (const line of diff.split('\n')) {
                if (line.startsWith('+')) {
                    console.log(`  ${chalk_1.default.green(line)}`);
                }
                else if (line.startsWith('-')) {
                    console.log(`  ${chalk_1.default.red(line)}`);
                }
                else {
                    console.log(`  ${theme_1.theme.dim(line)}`);
                }
            }
        }
        if (action.tool === 'run_command') {
            console.log('');
            console.log(`  ${theme_1.theme.bold('Command:')} ${theme_1.theme.highlight(String(action.args.command))}`);
        }
        console.log((0, theme_1.divider)());
        const { approved } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'approved',
                message: 'Approve this action?',
                default: false,
            },
        ]);
        return approved;
    }
    showPlan(plan) {
        console.log('');
        console.log(theme_1.theme.brandBold(' Plan:'));
        console.log(theme_1.theme.dim('─'.repeat(40)));
        for (const line of plan.split('\n')) {
            console.log(`  ${line}`);
        }
        console.log(theme_1.theme.dim('─'.repeat(40)));
        console.log('');
    }
    showMessage(role, content) {
        if (role === 'assistant') {
            console.log('');
            console.log(theme_1.theme.brand(' Rivet:'));
            for (const line of content.split('\n')) {
                console.log(`  ${line}`);
            }
            console.log('');
        }
    }
    showToolResult(name, output, error) {
        if (error) {
            console.log(theme_1.theme.error(`  [${name}] Error: ${error}`));
        }
        else if (output) {
            const lines = output.split('\n');
            const preview = lines.slice(0, 10).join('\n');
            console.log(theme_1.theme.dim(`  [${name}] ${preview}`));
            if (lines.length > 10) {
                console.log(theme_1.theme.dim(`  ... (${lines.length - 10} more lines)`));
            }
        }
    }
}
exports.TerminalApprovalHandler = TerminalApprovalHandler;
