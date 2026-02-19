# Rivet by PulseSpark.ai

> Agentic workflows from your terminal.

Rivet is a security-first, provider-agnostic CLI agent that runs locally on your computer. It can chat interactively, plan tasks, propose actions with diff previews, execute approved actions, and log every run for audit and replay.

## Quickstart

```bash
npm i -g @pulsespark/rivet
rivet init
rivet chat
```

## What it does

- **Chat interactively** - Talk to an AI agent in your terminal that can read files, write code, and run commands
- **Plan and propose** - The agent creates plans and proposes actions. Nothing executes without your approval
- **Diff-based writes** - Every file modification shows a clear diff before touching your code
- **Audit everything** - Every run is logged with full details: plans, actions, approvals, and outputs
- **Any LLM provider** - Works with OpenAI, Anthropic, Together, Groq, Ollama, or any custom API

## Security model

Rivet follows a **default-deny** security model:

- `write_file` and `run_command` are **disabled by default**
- All file operations are **sandboxed** to the workspace root
- Dangerous commands are **blocked** by regex deny patterns (rm -rf, sudo, etc.)
- File writes require **diff approval** before changes are applied
- Commands require **explicit approval** unless allowlisted
- Secrets are **automatically redacted** from logs and LLM context

## Commands

| Command | Description |
|---------|-------------|
| `rivet init` | Initialize `.rivet/` configuration in your project |
| `rivet chat` | Start an interactive agent session |
| `rivet run "<task>"` | One-shot task execution with plan/approve/execute cycle |
| `rivet logs [id]` | View recent runs or inspect a specific run |
| `rivet config` | View and update provider settings |

### Flags

- `--dry-run` - Plan only, do not execute any actions
- `--yes` - Auto-approve low-risk actions (reads, searches)

## Provider setup

### OpenAI (default)

```bash
export OPENAI_API_KEY=sk-...
rivet init
rivet chat
```

### Anthropic (Claude)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
rivet config --set provider=anthropic
rivet config --set model=claude-sonnet-4-20250514
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

### Custom HTTP API

Create `.rivet/provider.custom.json`:

```json
{
  "type": "custom_http",
  "url": "https://api.vendor.com/v1/chat",
  "headers": { "Authorization": "Bearer ${VENDOR_API_KEY}" },
  "body_template": { "model": "${MODEL}", "messages": "${MESSAGES_JSON}" },
  "response_paths": { "text": "data.reply", "tool_calls": "data.tool_calls" }
}
```

## Project structure

```
rivet/
  apps/
    site/                 # Next.js documentation website
  packages/
    rivet-cli/            # CLI implementation (commands, UI, terminal handling)
    core/                 # Agent loop, tools, permissions, run logging
    providers/            # LLM provider adapters (OpenAI, Anthropic, custom)
    shared/               # Types, utilities, constants
```

## Example workflows

```bash
# Scaffold a Next.js project
rivet run "Create a Next.js app with TypeScript and Tailwind"

# Generate a README
rivet run "Generate a comprehensive README for this project"

# Add error handling
rivet run "Add try-catch error handling to all API routes"

# Interactive refactoring
rivet chat
> Refactor the user service to use dependency injection
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
cd packages/core
pnpm test
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -am 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

Please ensure:
- All tests pass
- Code follows existing conventions
- Security model is not weakened
- New tools include proper permission checks

## License

MIT - see [LICENSE](LICENSE) for details.

---

Built with care by [PulseSpark.ai](https://pulsesparkai.com)
