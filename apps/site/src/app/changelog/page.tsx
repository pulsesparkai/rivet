import { PageLayout } from '@/components/page-layout';

export default function ChangelogPage() {
  return (
    <PageLayout title="Changelog" description="What's new in Rivet.">
      <h2>v0.1.0 - Initial Release</h2>
      <p className="text-sm text-gray-500">February 2026</p>

      <h3>Features</h3>
      <ul>
        <li>Interactive chat mode (<code>rivet chat</code>)</li>
        <li>One-shot task execution (<code>rivet run</code>)</li>
        <li>Project initialization (<code>rivet init</code>)</li>
        <li>Run logging and audit trail (<code>rivet logs</code>)</li>
        <li>Interactive configuration (<code>rivet config</code>)</li>
      </ul>

      <h3>Provider support</h3>
      <ul>
        <li>OpenAI-compatible endpoints (OpenAI, Together, Groq, Ollama, etc.)</li>
        <li>Anthropic (Claude) native API</li>
        <li>Custom HTTP provider for any API</li>
      </ul>

      <h3>Security</h3>
      <ul>
        <li>Default-deny for write and command operations</li>
        <li>Workspace sandboxing with path enforcement</li>
        <li>Diff-based file write approvals</li>
        <li>Command deny patterns (dangerous command blocking)</li>
        <li>Command allowlisting</li>
        <li>Secrets firewall with automatic redaction</li>
      </ul>

      <h3>Tools</h3>
      <ul>
        <li><code>list_dir</code> - Directory listing</li>
        <li><code>read_file</code> - File reading with secret redaction</li>
        <li><code>write_file</code> - File writing with diff preview</li>
        <li><code>run_command</code> - Command execution with approval gates</li>
        <li><code>search_in_files</code> - Pattern search across files</li>
      </ul>

      <h3>CLI flags</h3>
      <ul>
        <li><code>--dry-run</code> for plan-only mode</li>
        <li><code>--yes</code> for auto-approving low-risk actions</li>
      </ul>
    </PageLayout>
  );
}
