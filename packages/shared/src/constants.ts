export const RIVET_DIR = '.rivet';
export const CONFIG_FILE = 'config.json';
export const PERMISSIONS_FILE = 'permissions.json';
export const MEMORY_FILE = 'memory.json';
export const RUNS_DIR = 'runs';
export const CUSTOM_PROVIDER_FILE = 'provider.custom.json';

export const DEFAULT_DENY_PATTERNS = [
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

export const SECRET_PATTERNS = [
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

export const DEFAULT_ALLOWED_DOMAINS = [
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.groq.com',
  'api.mistral.ai',
  'api.together.xyz',
  'openrouter.ai',
];

export const DEFAULT_PERMISSIONS: Record<string, unknown> = {
  workspace_root: '.',
  allowed_paths: ['.'],
  run_command: false,
  write_file: false,
  require_approval_for_commands: true,
  require_diff_approval: true,
  allowlisted_commands: [],
  deny_patterns: DEFAULT_DENY_PATTERNS,
  network_access: false,
  allowed_domains: [],
  max_input_length: 50_000,
  approval_timeout_ms: 300_000,
};

export const DEFAULT_CONFIG = {
  provider: 'openai_compatible',
  model: 'gpt-4o-mini',
  base_url: 'https://api.openai.com/v1',
  api_key_env: 'OPENAI_API_KEY',
};

export const SOUL_FILE = 'soul.md';

export const SOUL_TEMPLATE = `# Rivet Soul (local preferences)

Rivet reads this file to match how you work.
Do not put secrets here (API keys, passwords, tokens, private client data).

## Who I am
- Name:
- Role:
- What I'm building / working on:

## How I want Rivet to behave
- Tone (crisp / verbose / minimal):
- Defaults (read-only vs write prompts):
- What to always ask before doing:
- What to never do:

## My environment
- OS:
- Shell:
- Repo / workspace conventions:

## Success criteria
- What "done" means:
- Quality bar:
`;
