import { PageLayout } from '@/components/page-layout';

export default function InstallPage() {
  return (
    <PageLayout title="Install Rivet" description="Get up and running in under a minute.">
      <h2>npm (recommended)</h2>
      <pre><code>npm i -g @pulsespark/rivet</code></pre>
      <p>Then initialize in your project directory:</p>
      <pre><code>{`cd your-project
rivet init
rivet chat`}</code></pre>

      <h2>curl installer (optional)</h2>
      <pre><code>{`curl -fsSL https://rivet.pulsesparkai.com/install.sh | bash`}</code></pre>
      <p>This downloads the latest release and adds <code>rivet</code> to your PATH.</p>

      <h2>From source</h2>
      <pre><code>{`git clone https://github.com/pulsespark/rivet.git
cd rivet
pnpm install
pnpm build
cd packages/rivet-cli
npm link`}</code></pre>

      <h2>Requirements</h2>
      <ul>
        <li>Node.js 18 or later</li>
        <li>An API key for your LLM provider (OpenAI, Anthropic, or any compatible API)</li>
      </ul>

      <h2>Quick setup</h2>
      <ol>
        <li>Run <code>rivet init</code> to create the <code>.rivet/</code> configuration directory</li>
        <li>Set your API key: <code>export OPENAI_API_KEY=sk-...</code></li>
        <li>Start chatting: <code>rivet chat</code></li>
        <li>Or run a one-shot task: <code>rivet run &quot;add error handling to server.ts&quot;</code></li>
      </ol>

      <h2>Verify installation</h2>
      <pre><code>rivet --version</code></pre>
      <p>You should see <code>0.1.0</code> printed to the terminal.</p>
    </PageLayout>
  );
}
