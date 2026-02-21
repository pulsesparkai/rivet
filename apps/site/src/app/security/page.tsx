import { PageLayout } from '@/components/page-layout';

export default function SecurityPage() {
  return (
    <PageLayout title="Security Model" description="How Rivet keeps your system safe.">
      <h2>Philosophy</h2>
      <p>
        Rivet follows a <strong>default-deny, approval-gated</strong> security model. The LLM never
        directly executes anything. Every action goes through permission checks, pattern matching,
        and user approval before touching your filesystem or running commands.
      </p>

      <h2>Default deny</h2>
      <p>Out of the box, Rivet denies:</p>
      <ul>
        <li><code>write_file</code> - disabled until explicitly enabled in permissions</li>
        <li><code>run_command</code> - disabled until explicitly enabled in permissions</li>
      </ul>
      <p>
        Read-only operations (<code>list_dir</code>, <code>read_file</code>,{' '}
        <code>search_in_files</code>) are allowed within the workspace sandbox.
      </p>

      <h2>Workspace sandbox</h2>
      <p>
        All file operations are restricted to the <code>workspace_root</code> defined in{' '}
        <code>.rivet/permissions.json</code>. Any attempt to access files outside this boundary is
        blocked. Path traversal attacks (e.g., <code>../../etc/passwd</code>) are prevented by
        resolving all paths before checking.
      </p>

      <h2>Diff-based file writes</h2>
      <p>
        When the agent proposes a file write, Rivet computes a diff between the current file content
        and the proposed content. The diff is displayed for review before any changes are applied.
        The user must explicitly approve each write.
      </p>

      <h2>Command deny patterns</h2>
      <p>
        Even when command execution is enabled, Rivet blocks dangerous commands by matching against
        a configurable deny list of regex patterns:
      </p>
      <ul>
        <li><code>rm -rf /</code></li>
        <li><code>sudo</code></li>
        <li><code>chmod -R</code></li>
        <li><code>mkfs</code></li>
        <li><code>dd</code></li>
        <li><code>curl | bash</code></li>
        <li>Fork bombs</li>
        <li><code>shutdown</code> / <code>reboot</code></li>
      </ul>
      <p>
        You can add custom deny patterns in <code>.rivet/permissions.json</code>.
      </p>

      <h2>Command allowlisting</h2>
      <p>
        You can allowlist specific commands that skip the approval prompt. Only exact matches or
        prefix matches are accepted:
      </p>
      <pre><code>{`{
  "allowlisted_commands": [
    "npm test",
    "npm run build",
    "git status"
  ]
}`}</code></pre>

      <h2>Secrets firewall</h2>
      <p>
        Rivet scans all tool outputs and file contents for common secret patterns before they are
        logged or sent to the LLM:
      </p>
      <ul>
        <li>API keys (OpenAI <code>sk-</code>, GitHub <code>ghp_</code>)</li>
        <li>AWS credentials</li>
        <li>Private keys (PEM format)</li>
        <li>Bearer tokens</li>
        <li>Generic password/secret/token patterns</li>
      </ul>
      <p>
        Detected secrets are replaced with <code>[REDACTED]</code> in logs and LLM context.
      </p>

      <h2>Permissions file</h2>
      <pre><code>{`{
  "workspace_root": ".",
  "allowed_paths": ["."],
  "run_command": false,
  "write_file": false,
  "require_approval_for_commands": true,
  "require_diff_approval": true,
  "allowlisted_commands": [],
  "deny_patterns": ["rm\\\\s+-rf\\\\s+/", "sudo\\\\s+", "..."],
  "network_access": false
}`}</code></pre>

      <h2>Network access</h2>
      <p>
        By default, network access is disabled. Only LLM provider API calls are allowed. The agent
        cannot make arbitrary HTTP requests unless <code>network_access</code> is set to{' '}
        <code>true</code>.
      </p>
    </PageLayout>
  );
}
