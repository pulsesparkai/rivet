"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.theme = void 0;
exports.banner = banner;
exports.divider = divider;
const chalk_1 = __importDefault(require("chalk"));
exports.theme = {
    brand: chalk_1.default.hex('#0ea5e9'),
    brandBold: chalk_1.default.hex('#0ea5e9').bold,
    success: chalk_1.default.green,
    error: chalk_1.default.red,
    warning: chalk_1.default.yellow,
    dim: chalk_1.default.dim,
    bold: chalk_1.default.bold,
    muted: chalk_1.default.gray,
    highlight: chalk_1.default.cyan,
    danger: chalk_1.default.redBright.bold,
};
function banner() {
    return [
        '',
        exports.theme.brand('  ╔══════════════════════════════════════╗'),
        exports.theme.brand('  ║') + exports.theme.brandBold('   Rivet') + exports.theme.dim(' by PulseSpark.ai') + exports.theme.brand('           ║'),
        exports.theme.brand('  ║') + exports.theme.dim('   Agentic workflows from your terminal') + exports.theme.brand(' ║'),
        exports.theme.brand('  ╚══════════════════════════════════════╝'),
        '',
    ].join('\n');
}
function divider() {
    return exports.theme.dim('─'.repeat(50));
}
