"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initRivet = initRivet;
exports.isInitialized = isInitialized;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const shared_1 = require("@pulsespark/shared");
function initRivet(workspaceRoot) {
    const rivetDir = path.join(workspaceRoot, shared_1.RIVET_DIR);
    const created = [];
    const existed = [];
    if (!fs.existsSync(rivetDir)) {
        fs.mkdirSync(rivetDir, { recursive: true });
        created.push(shared_1.RIVET_DIR);
    }
    else {
        existed.push(shared_1.RIVET_DIR);
    }
    const runsDir = path.join(rivetDir, shared_1.RUNS_DIR);
    if (!fs.existsSync(runsDir)) {
        fs.mkdirSync(runsDir, { recursive: true });
        created.push(`${shared_1.RIVET_DIR}/${shared_1.RUNS_DIR}`);
    }
    else {
        existed.push(`${shared_1.RIVET_DIR}/${shared_1.RUNS_DIR}`);
    }
    const configPath = path.join(rivetDir, shared_1.CONFIG_FILE);
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify(shared_1.DEFAULT_CONFIG, null, 2), 'utf-8');
        created.push(`${shared_1.RIVET_DIR}/${shared_1.CONFIG_FILE}`);
    }
    else {
        existed.push(`${shared_1.RIVET_DIR}/${shared_1.CONFIG_FILE}`);
    }
    const permPath = path.join(rivetDir, shared_1.PERMISSIONS_FILE);
    if (!fs.existsSync(permPath)) {
        const perms = { ...shared_1.DEFAULT_PERMISSIONS, workspace_root: workspaceRoot };
        fs.writeFileSync(permPath, JSON.stringify(perms, null, 2), 'utf-8');
        created.push(`${shared_1.RIVET_DIR}/${shared_1.PERMISSIONS_FILE}`);
    }
    else {
        existed.push(`${shared_1.RIVET_DIR}/${shared_1.PERMISSIONS_FILE}`);
    }
    const memPath = path.join(rivetDir, shared_1.MEMORY_FILE);
    if (!fs.existsSync(memPath)) {
        fs.writeFileSync(memPath, JSON.stringify({ entries: [] }, null, 2), 'utf-8');
        created.push(`${shared_1.RIVET_DIR}/${shared_1.MEMORY_FILE}`);
    }
    else {
        existed.push(`${shared_1.RIVET_DIR}/${shared_1.MEMORY_FILE}`);
    }
    return { created, existed };
}
function isInitialized(workspaceRoot) {
    const rivetDir = path.join(workspaceRoot, shared_1.RIVET_DIR);
    return fs.existsSync(rivetDir) && fs.existsSync(path.join(rivetDir, shared_1.CONFIG_FILE));
}
