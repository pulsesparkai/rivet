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
exports.loadPermissions = loadPermissions;
exports.savePermissions = savePermissions;
exports.isPathAllowed = isPathAllowed;
exports.isCommandAllowed = isCommandAllowed;
exports.matchesDenyPattern = matchesDenyPattern;
exports.isCommandAllowlisted = isCommandAllowlisted;
exports.requiresApproval = requiresApproval;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const shared_1 = require("@pulsespark/shared");
function loadPermissions(workspaceRoot) {
    const permPath = path.join(workspaceRoot, shared_1.RIVET_DIR, shared_1.PERMISSIONS_FILE);
    try {
        const raw = fs.readFileSync(permPath, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return shared_1.DEFAULT_PERMISSIONS;
    }
}
function savePermissions(workspaceRoot, config) {
    const permPath = path.join(workspaceRoot, shared_1.RIVET_DIR, shared_1.PERMISSIONS_FILE);
    fs.writeFileSync(permPath, JSON.stringify(config, null, 2), 'utf-8');
}
function isPathAllowed(targetPath, permissions, workspaceRoot) {
    const resolved = path.resolve(workspaceRoot, targetPath);
    const resolvedRoot = path.resolve(workspaceRoot, permissions.workspace_root);
    if (!resolved.startsWith(resolvedRoot)) {
        return false;
    }
    if (permissions.allowed_paths.length === 0) {
        return true;
    }
    return permissions.allowed_paths.some((allowed) => {
        const resolvedAllowed = path.resolve(workspaceRoot, allowed);
        return resolved.startsWith(resolvedAllowed);
    });
}
function isCommandAllowed(command, permissions) {
    if (!permissions.run_command) {
        return { allowed: false, reason: 'Command execution is disabled in permissions' };
    }
    const denyMatch = matchesDenyPattern(command, permissions.deny_patterns);
    if (denyMatch) {
        return { allowed: false, reason: `Command matches deny pattern: ${denyMatch}` };
    }
    return { allowed: true };
}
function matchesDenyPattern(command, denyPatterns) {
    for (const pattern of denyPatterns) {
        try {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(command)) {
                return pattern;
            }
        }
        catch {
            continue;
        }
    }
    return null;
}
function isCommandAllowlisted(command, allowlist) {
    return allowlist.some((allowed) => {
        const trimmedCmd = command.trim();
        const trimmedAllowed = allowed.trim();
        return trimmedCmd === trimmedAllowed || trimmedCmd.startsWith(trimmedAllowed + ' ');
    });
}
function requiresApproval(toolName, permissions, command) {
    if (toolName === 'write_file') {
        return permissions.require_diff_approval;
    }
    if (toolName === 'run_command') {
        if (!permissions.require_approval_for_commands)
            return false;
        if (command && isCommandAllowlisted(command, permissions.allowlisted_commands))
            return false;
        return true;
    }
    return false;
}
