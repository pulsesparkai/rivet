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
exports.generateId = generateId;
exports.timestamp = timestamp;
exports.redactSecrets = redactSecrets;
exports.containsSecrets = containsSecrets;
exports.interpolateEnvVars = interpolateEnvVars;
exports.getNestedValue = getNestedValue;
exports.formatTimestamp = formatTimestamp;
exports.truncate = truncate;
const crypto = __importStar(require("crypto"));
const constants_1 = require("./constants");
function generateId() {
    return crypto.randomBytes(8).toString('hex');
}
function timestamp() {
    return new Date().toISOString();
}
function redactSecrets(text) {
    let result = text;
    for (const pattern of constants_1.SECRET_PATTERNS) {
        result = result.replace(new RegExp(pattern, 'g'), '[REDACTED]');
    }
    return result;
}
function containsSecrets(text) {
    return constants_1.SECRET_PATTERNS.some((pattern) => pattern.test(text));
}
function interpolateEnvVars(template) {
    return template.replace(/\$\{(\w+)\}/g, (_, varName) => {
        return process.env[varName] || '';
    });
}
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        if (current && typeof current === 'object') {
            return current[key];
        }
        return undefined;
    }, obj);
}
function formatTimestamp(iso) {
    const d = new Date(iso);
    return d.toLocaleString();
}
function truncate(str, maxLen) {
    if (str.length <= maxLen)
        return str;
    return str.slice(0, maxLen - 3) + '...';
}
