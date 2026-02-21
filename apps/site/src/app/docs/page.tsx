import { PageLayout } from '@/components/page-layout';

export default function DocsPage() {
  return (
    <PageLayout title="Documentation" description="Everything you need to know about Rivet.">
      <h2>Overview</h2>
      <p>
        Rivet is a security-first, agentic CLI that runs locally on your computer. It connects to
        any LLM provider and gives the model access to local tools (reading files, writing files,
        running commands) while enforcing strict security controls.
      </p>

      <h2>Commands</h2>

      <h3>rivet init</h3>
      <p>
        Initializes a <code>.rivet/</code> directory in your project with default configuration files:
      </p>
      <ul>
        <li><code>config.json</code> - Provider and model settings</li>
        <li><code>permissions.json</code> - Security controls and sandboxing</li>
        <li><code>memory.json</code> - Project memory for context persistence</li>
        <li><code>runs/</code> - Directory for audit logs</li>
      </ul>

      <h3>rivet chat</h3>
      <p>
        Starts an interactive chat session with the agent. You can type natural language messages,
        and the agent will plan and propose actions for your approval.
      </p>
      <p>In-chat commands:</p>
      <ul>
        <li><code>/plan</code> - Ask the agent to create a plan</li>
        <li><code>/tools</code> - List available tools</li>
        <li><code>/permissions</code> - Show current permission settings</li>
        <li><code>/exit</code> - End the session</li>
      </ul>

      <h3>rivet run &quot;task&quot;</h3>
      <p>
        One-shot execution mode. The agent receives your task, creates a plan, proposes actions,
        asks for approval, executes, and summarizes.
      </p>
      <p>Flags:</p>
      <ul>
        <li><code>--dry-run</code> - Plan only, do not execute any actions</li>
        <li><code>--yes</code> - Auto-approve low-risk actions (reads, searches). High-risk actions still require approval.</li>
      </ul>

      <h3>rivet logs [id]</h3>
      <p>
        Without an ID, shows recent runs with timestamps and status. With an ID, prints the full
        run log including plans, actions, approvals, and diffs.
      </p>

      <h3>rivet config</h3>
      <p>
        Interactive configuration editor. Change your provider, model, API key environment variable,
        or base URL.
      </p>

      <h2>Agent Loop</h2>
      <p>
        The agent never directly executes anything. The core loop works as follows:
      </p>
      <ol>
        <li>Send the user message and available tools to the LLM</li>
        <li>Receive a response with optional tool calls</li>
        <li>For each tool call, validate permissions</li>
        <li>Request user approval for risky actions (with diff preview for file writes)</li>
        <li>Execute approved actions locally</li>
        <li>Send tool results back to the model</li>
        <li>Repeat until the model produces a final text response with no tool calls</li>
      </ol>

      <h2>Tools</h2>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left">Tool</th>
            <th className="text-left">Description</th>
            <th className="text-left">Risk</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>list_dir(path)</code></td>
            <td>List files and directories</td>
            <td>Low</td>
          </tr>
          <tr>
            <td><code>read_file(path)</code></td>
            <td>Read file contents</td>
            <td>Low</td>
          </tr>
          <tr>
            <td><code>write_file(path, content)</code></td>
            <td>Write to a file (diff preview required)</td>
            <td>Medium</td>
          </tr>
          <tr>
            <td><code>run_command(command, cwd)</code></td>
            <td>Execute a shell command</td>
            <td>High</td>
          </tr>
          <tr>
            <td><code>search_in_files(query, globs)</code></td>
            <td>Search for patterns in files</td>
            <td>Low</td>
          </tr>
        </tbody>
      </table>

      <h2>Configuration</h2>
      <p>
        All configuration lives in <code>.rivet/config.json</code>. Example:
      </p>
      <pre><code>{`{
  "provider": "openai_compatible",
  "model": "gpt-4.1-mini",
  "base_url": "https://api.openai.com/v1",
  "api_key_env": "OPENAI_API_KEY"
}`}</code></pre>

      <h2>Project structure</h2>
      <pre><code>{`rivet/
  apps/
    site/                 # Next.js docs + landing page
  packages/
    rivet-cli/            # CLI implementation
    core/                 # Agent loop, tools, permissions, logging
    providers/            # LLM provider adapters
    shared/               # Types, utilities, constants`}</code></pre>
    </PageLayout>
  );
}
