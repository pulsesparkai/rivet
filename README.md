<div align="center">

```
  ██████╗ ██╗██╗   ██╗███████╗████████╗
  ██╔══██╗██║██║   ██║██╔════╝╚══██╔══╝
  ██████╔╝██║██║   ██║█████╗     ██║
  ██╔══██╗██║╚██╗ ██╔╝██╔══╝     ██║
  ██║  ██║██║ ╚████╔╝ ███████╗   ██║
  ╚═╝  ╚═╝╚═╝  ╚═══╝  ╚══════╝   ╚═╝
```

**Open-source local AI agent. Runs on your machine. Your data stays yours.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://typescriptlang.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/pulsespark/rivet/pulls)

</div>

---

Rivet is a provider-agnostic, security-first AI agent that runs entirely on your computer. It can write code, run commands, search the web, manage files, build websites, generate leads, and automate multi-step workflows — all from your terminal or a local dashboard. No cloud. No telemetry. No data leaves your machine.

> **Notice:** Created by [PulseSpark AI](https://pulsesparkai.com) and released as open-source software. This is a community project — PulseSpark AI provides no warranty, no SLA, and no guarantee of support. Use at your own risk. See [LICENSE](LICENSE).

---

## What makes Rivet different

| | Rivet | Cloud agents (ChatGPT, Claude, etc.) |
|---|---|---|
| **Where it runs** | 100% on your machine | Their servers |
| **Your code** | Never leaves your disk | Sent to their API |
| **Privacy** | Zero telemetry | Data used for training |
| **Provider** | Any LLM (OpenAI, Anthropic, Ollama, Groq, etc.) | Locked to one vendor |
| **Cost** | Your API key, your rates | Their pricing tiers |
| **Customizable** | Fork it, change anything | Closed source |
| **Audit trail** | Every action logged locally with SHA-256 traces | Black box |
| **Offline mode** | Works with local models (Ollama) | Requires internet |

## Quickstart

```bash
npm i -g @pulsesparkai/rivet
rivet init
rivet chat
```

## Features

### Agent core
- **Interactive chat** — talk to an AI agent that reads files, writes code, runs commands, fetches URLs
- **Streaming** — real-time token streaming for OpenAI and Anthropic providers
- **Parallel tool execution** — read-only tools run concurrently for speed
- **Precise editing** — `str_replace` tool for surgical line-level edits with diff preview
- **Build verification** — auto-runs your build command after file edits to catch breakage
- **Semantic search** — TF-IDF index of your entire repo for "where/how" questions
- **Subagent delegation** — break complex tasks into parallel sub-tasks
- **Reflexion** — structured self-critique after repeated failures
- **Conversation summarization** — compresses older messages to stay within context limits
- **Stamina system** — warns you when approaching iteration/context limits instead of silently stopping

### Dashboard (`rivet dashboard`)
- **Overview** — run statistics, activity timeline, pillar highlights
- **Runs** — full history with trace viewer, run diffing, replay with different models
- **Workflows** — gallery of built-in and custom multi-step automations
- **Traces & Diffs** — side-by-side comparison of any two agent runs
- **Secrets Vault** — AES-256-GCM encrypted local secret storage
- **Security Center** — threat feed, content guard status, tool heatmap
- **Chat** — web-based agent chat with approval cards and live streaming
- **File preview** — HTML/image files the agent creates are previewable inline
- **Settings** — visual config for provider, model, permissions, iteration limits

### Security
- **Default-deny** — write and command tools are off until you enable them
- **Workspace sandbox** — all file operations locked to your project root
- **Command analysis** — blocks dangerous patterns (rm -rf, sudo, eval, pipe-to-shell)
- **Content guard** — detects prompt injection, data exfiltration, and base64 smuggling
- **URL safety filter** — blocks dark web TLDs, adult content domains, suspicious URL patterns
- **Per-tool approval** — write tools require explicit approval; escalated when untrusted content detected
- **Encrypted secrets** — AES-256-GCM with machine-bound key derivation (PBKDF2, 100k iterations)
- **Secret redaction** — credentials auto-stripped from logs and LLM context
- **TOCTOU protection** — paths resolved before permission checks to prevent symlink attacks
- **Deterministic execution traces** — SHA-256 fingerprints at every step for reproducibility
- **.rivet/ write-protection** — the agent cannot modify its own config or permissions

### Workflows
- **Built-in workflows** — `hunt-leads`, `code-review`, `refactor` ready out of the box
- **Custom workflows** — define multi-step JSON pipelines with parameter interpolation
- **Approval gates** — checkpoint steps that pause for human review
- **Retry policies** — configurable retries per step with backoff
- **Output piping** — chain step outputs into subsequent steps

## Commands

| Command | Description |
|---------|-------------|
| `rivet init` | Initialize `.rivet/` configuration in your project |
| `rivet chat` | Start an interactive agent session |
| `rivet run "<task>"` | One-shot task execution |
| `rivet dashboard` | Launch the local web dashboard |
| `rivet logs [id]` | View recent runs or inspect a specific run |
| `rivet config` | View and update provider settings |
| `rivet doctor` | Self-test: check config, provider, permissions |
| `rivet permissions` | View and edit permission settings |
| `rivet soul` | Create/edit your soul.md preferences file |
| `rivet secrets set <name>` | Store an encrypted secret locally |
| `rivet secrets list` | List stored secrets (names only, never values) |
| `rivet workflow list` | Show available workflows |
| `rivet workflow run <name>` | Execute a workflow |
| `rivet runs diff <id1> <id2>` | Compare two agent runs |
| `rivet runs trace <id>` | View execution trace for a run |

### Flags

- `--dry-run` — plan only, do not execute
- `--yes` — auto-approve low-risk actions

## Provider setup

### Anthropic (Claude)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
rivet config --set provider=anthropic
rivet config --set model=claude-sonnet-4-20250514
rivet chat
```

### OpenAI

```bash
export OPENAI_API_KEY=sk-...
rivet init
rivet chat
```

### Ollama (local, free, private)

```bash
ollama pull qwen2.5-coder:14b
rivet config --set provider=openai_compatible
rivet config --set model=qwen2.5-coder:14b
rivet config --set base_url=http://localhost:11434/v1
rivet chat
```

### Any OpenAI-compatible API

```json
{
  "provider": "openai_compatible",
  "model": "llama3-70b",
  "base_url": "https://api.groq.com/openai/v1",
  "api_key_env": "GROQ_API_KEY"
}
```

## Project structure

```
rivet/
  packages/
    core/           # Agent loop, tools, permissions, security, RAG, workflows
    providers/      # LLM provider adapters (OpenAI, Anthropic, custom HTTP)
    rivet-cli/      # CLI commands, dashboard server, static UI, terminal UI
    rivet-vscode/   # VS Code extension (Activity Bar webview)
    shared/         # Types, utilities, constants
  apps/
    site/           # Documentation website (Next.js)
```

## Development

```bash
git clone https://github.com/pulsespark/rivet.git
cd rivet
pnpm install
pnpm build
```

Run tests:

```bash
cd packages/core && pnpm test
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push and open a Pull Request

Please ensure:
- All tests pass
- Code follows existing conventions
- Security model is not weakened
- New tools include proper permission checks

## Disclaimer

```
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
```

PulseSpark AI and all contributors disclaim any liability for damages arising from the use of this software. This is an open-source community project — **not a commercial product**. There is no guarantee of support, updates, or fitness for any particular purpose. You are solely responsible for how you use this tool and any actions it performs on your system.

Do not use Rivet with untrusted inputs in production environments without thorough review. The content guard and sandboxing features reduce risk but cannot guarantee complete protection against all attack vectors.

By using this software, you agree that:
- You assume all risk associated with its use
- You will not hold PulseSpark AI or any contributor liable for any damages
- You are responsible for compliance with all applicable laws in your jurisdiction
- You will review the [LICENSE](LICENSE) before use

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built by [PulseSpark AI](https://pulsesparkai.com) and the open-source community.

Star the repo if you find it useful.

</div>
