"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.DEFAULT_PERMISSIONS = exports.SECRET_PATTERNS = exports.DEFAULT_DENY_PATTERNS = exports.CUSTOM_PROVIDER_FILE = exports.RUNS_DIR = exports.MEMORY_FILE = exports.PERMISSIONS_FILE = exports.CONFIG_FILE = exports.RIVET_DIR = void 0;
exports.RIVET_DIR = '.rivet';
exports.CONFIG_FILE = 'config.json';
exports.PERMISSIONS_FILE = 'permissions.json';
exports.MEMORY_FILE = 'memory.json';
exports.RUNS_DIR = 'runs';
exports.CUSTOM_PROVIDER_FILE = 'provider.custom.json';
exports.DEFAULT_DENY_PATTERNS = [
    'rm\\s+-rf\\s+/',
    'sudo\\s+',
    'chmod\\s+-R',
    'mkfs',
    '\\bdd\\b\\s+',
    'curl.*\\|.*bash',
    'wget.*\\|.*bash',
    ':\\(\\)\\{\\s*:\\|:\\s*&\\s*\\}\\s*;\\s*:',
    'mv\\s+/\\s',
    '>(\\s*/dev/sd|\\s*/dev/nvme)',
    'shutdown',
    'reboot',
    'init\\s+0',
    'rm\\s+-rf\\s+\\*',
    'fork\\s*bomb',
];
exports.SECRET_PATTERNS = [
    /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[\w\-]{20,}/i,
    /(?:secret|token|password|passwd|pwd)\s*[:=]\s*['"]?[\w\-]{8,}/i,
    /(?:aws_access_key_id)\s*[:=]\s*['"]?[A-Z0-9]{20}/i,
    /(?:aws_secret_access_key)\s*[:=]\s*['"]?[\w/+]{40}/i,
    /sk-[a-zA-Z0-9]{20,}/,
    /ghp_[a-zA-Z0-9]{36,}/,
    /gho_[a-zA-Z0-9]{36,}/,
    /(?:-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----)/,
    /(?:Bearer\s+)[\w\-\.]{20,}/i,
];
exports.DEFAULT_PERMISSIONS = {
    workspace_root: '.',
    allowed_paths: ['.'],
    run_command: false,
    write_file: false,
    require_approval_for_commands: true,
    require_diff_approval: true,
    allowlisted_commands: [],
    deny_patterns: exports.DEFAULT_DENY_PATTERNS,
    network_access: false,
};
exports.DEFAULT_CONFIG = {
    provider: 'openai_compatible',
    model: 'gpt-4.1-mini',
    base_url: 'https://api.openai.com/v1',
    api_key_env: 'OPENAI_API_KEY',
};
