export interface ProviderPreset {
  label: string;
  provider: string;
  base_url?: string;
  api_key_env: string;
  default_model: string;
  key_required: boolean;
  note?: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    label: 'Anthropic (Claude)',
    provider: 'anthropic',
    api_key_env: 'ANTHROPIC_API_KEY',
    default_model: 'claude-sonnet-4-20250514',
    key_required: true,
  },
  {
    label: 'OpenAI',
    provider: 'openai_compatible',
    base_url: 'https://api.openai.com/v1',
    api_key_env: 'OPENAI_API_KEY',
    default_model: 'gpt-4o-mini',
    key_required: true,
  },
  {
    label: 'OpenRouter',
    provider: 'openai_compatible',
    base_url: 'https://openrouter.ai/api/v1',
    api_key_env: 'OPENROUTER_API_KEY',
    default_model: 'anthropic/claude-sonnet-4-20250514',
    key_required: true,
  },
  {
    label: 'Groq',
    provider: 'openai_compatible',
    base_url: 'https://api.groq.com/openai/v1',
    api_key_env: 'GROQ_API_KEY',
    default_model: 'llama-3.3-70b-versatile',
    key_required: true,
  },
  {
    label: 'Together',
    provider: 'openai_compatible',
    base_url: 'https://api.together.xyz/v1',
    api_key_env: 'TOGETHER_API_KEY',
    default_model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    key_required: true,
  },
  {
    label: 'Ollama (local)',
    provider: 'openai_compatible',
    base_url: 'http://localhost:11434/v1',
    api_key_env: 'OLLAMA_API_KEY',
    default_model: 'llama3.2',
    key_required: false,
    note: 'Usually no key needed. Leave OLLAMA_API_KEY empty or set to "ollama".',
  },
  {
    label: 'Custom OpenAI-compatible',
    provider: 'openai_compatible',
    api_key_env: '',
    default_model: '',
    key_required: true,
  },
  {
    label: 'Set up later (DEMO MODE)',
    provider: 'demo',
    api_key_env: '',
    default_model: 'none',
    key_required: false,
    note: 'No LLM calls. Explore Rivet safely. Configure later with `rivet config`.',
  },
];

export const SAFETY_SCREEN = `
──────────────────────────────────────────────────────
  Rivet by PulseSpark AI — Safety Latch
──────────────────────────────────────────────────────
Rivet is open source and runs on your machine.

Use at your own risk:
- You are responsible for any commands you approve.
- Don't paste secrets into chat (keys, passwords, tokens, private data).
- If you connect a provider, prompts may be sent to that API.

Built-in safety:
- Starts READ-ONLY by default.
- Writes and commands require approval.
- Dangerous commands are blocked by policy.
- Logs may be saved to .rivet/runs/

Press Enter to continue.
──────────────────────────────────────────────────────`;
