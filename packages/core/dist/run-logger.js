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
exports.RunLogger = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const shared_1 = require("@pulsespark/shared");
class RunLogger {
    log;
    logPath;
    constructor(workspaceRoot, task, provider, model) {
        const ts = (0, shared_1.timestamp)();
        const id = (0, shared_1.generateId)();
        this.log = {
            id,
            timestamp: ts,
            task,
            provider,
            model,
            actions: [],
            status: 'running',
        };
        const runsDir = path.join(workspaceRoot, shared_1.RIVET_DIR, shared_1.RUNS_DIR);
        if (!fs.existsSync(runsDir)) {
            fs.mkdirSync(runsDir, { recursive: true });
        }
        const safeTs = ts.replace(/[:.]/g, '-');
        this.logPath = path.join(runsDir, `${safeTs}_${id}.json`);
        this.save();
    }
    get runId() {
        return this.log.id;
    }
    setPlan(plan) {
        this.log.plan = (0, shared_1.redactSecrets)(plan);
        this.save();
    }
    addAction(action) {
        this.log.actions.push({
            ...action,
            timestamp: (0, shared_1.timestamp)(),
            data: this.redactData(action.data),
        });
        this.save();
    }
    complete(summary) {
        this.log.summary = (0, shared_1.redactSecrets)(summary);
        this.log.status = 'completed';
        this.save();
    }
    fail(error) {
        this.log.summary = (0, shared_1.redactSecrets)(error);
        this.log.status = 'failed';
        this.save();
    }
    cancel() {
        this.log.status = 'cancelled';
        this.save();
    }
    getLog() {
        return { ...this.log };
    }
    redactData(data) {
        const redacted = {};
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string') {
                redacted[key] = (0, shared_1.redactSecrets)(value);
            }
            else if (typeof value === 'object' && value !== null) {
                redacted[key] = this.redactData(value);
            }
            else {
                redacted[key] = value;
            }
        }
        return redacted;
    }
    save() {
        fs.writeFileSync(this.logPath, JSON.stringify(this.log, null, 2), 'utf-8');
    }
    static listRuns(workspaceRoot) {
        const runsDir = path.join(workspaceRoot, shared_1.RIVET_DIR, shared_1.RUNS_DIR);
        if (!fs.existsSync(runsDir))
            return [];
        const files = fs.readdirSync(runsDir).filter((f) => f.endsWith('.json')).sort().reverse();
        return files.map((f) => {
            const raw = fs.readFileSync(path.join(runsDir, f), 'utf-8');
            return JSON.parse(raw);
        });
    }
    static getRunById(workspaceRoot, id) {
        const runs = RunLogger.listRuns(workspaceRoot);
        return runs.find((r) => r.id === id || r.id.startsWith(id)) || null;
    }
}
exports.RunLogger = RunLogger;
