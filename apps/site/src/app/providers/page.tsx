import { PageLayout } from '@/components/page-layout';

export default function ProvidersPage() {
  return (
    <PageLayout title="Providers" description="Use any LLM provider with Rivet.">
      <h2>Provider-agnostic architecture</h2>
      <p>
        Rivet uses a pluggable provider adapter system. The core agent loop knows nothing about
        specific LLM APIs. All provider-specific logic lives in the{' '}
        <code>packages/providers</code> package.
      </p>
      <p>
        Every provider implements the same interface:
      </p>
      <pre><code>{`interface ProviderAdapter {
  name: string;
  generate(request: {
    messages: Message[];
    tools?: ToolDefinition[];
    tool_mode?: string;
  }): Promise<{ text: string; tool_calls?: ToolCall[] }>;
}`}</code></pre>

      <h2>OpenAI-compatible</h2>
      <p>
        Works with OpenAI, Together AI, Groq, Fireworks, Ollama, LM Studio, and any API that
        follows the OpenAI chat completions format.
      </p>
      <pre><code>{`{
  "provider": "openai_compatible",
  "model": "gpt-4.1-mini",
  "base_url": "https://api.openai.com/v1",
  "api_key_env": "OPENAI_API_KEY"
}`}</code></pre>

      <h3>Examples for other providers</h3>

      <p><strong>Together AI:</strong></p>
      <pre><code>{`{
  "provider": "openai_compatible",
  "model": "meta-llama/Llama-3-70b-chat-hf",
  "base_url": "https://api.together.xyz/v1",
  "api_key_env": "TOGETHER_API_KEY"
}`}</code></pre>

      <p><strong>Groq:</strong></p>
      <pre><code>{`{
  "provider": "openai_compatible",
  "model": "llama3-70b-8192",
  "base_url": "https://api.groq.com/openai/v1",
  "api_key_env": "GROQ_API_KEY"
}`}</code></pre>

      <p><strong>Ollama (local):</strong></p>
      <pre><code>{`{
  "provider": "openai_compatible",
  "model": "llama3",
  "base_url": "http://localhost:11434/v1",
  "api_key_env": "OLLAMA_API_KEY"
}`}</code></pre>

      <h2>Anthropic (Claude)</h2>
      <p>
        Native Anthropic API support with proper message formatting and tool use.
      </p>
      <pre><code>{`{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "api_key_env": "ANTHROPIC_API_KEY"
}`}</code></pre>

      <h2>Custom HTTP (any API)</h2>
      <p>
        For APIs that don&apos;t follow standard formats, use the custom HTTP provider. You define the
        URL, headers, request body template, and response field paths.
      </p>
      <p>
        Create <code>.rivet/provider.custom.json</code>:
      </p>
      <pre><code>{`{
  "type": "custom_http",
  "url": "https://api.vendor.com/v1/chat",
  "headers": {
    "Authorization": "Bearer \${VENDOR_API_KEY}"
  },
  "body_template": {
    "model": "\${MODEL}",
    "messages": "\${MESSAGES_JSON}"
  },
  "response_paths": {
    "text": "data.reply",
    "tool_calls": "data.tool_calls"
  }
}`}</code></pre>
      <p>
        Then set your config to:
      </p>
      <pre><code>{`{
  "provider": "custom_http",
  "model": "vendor-model-name"
}`}</code></pre>

      <h3>Template variables</h3>
      <ul>
        <li><code>{`\${MODEL}`}</code> - Replaced with the model name from config</li>
        <li><code>{`\${MESSAGES_JSON}`}</code> - Replaced with the messages array</li>
        <li><code>{`\${TOOLS_JSON}`}</code> - Replaced with the tools array</li>
        <li><code>{`\${ENV_VAR}`}</code> - Replaced with the value of any environment variable</li>
      </ul>

      <h3>Response paths</h3>
      <p>
        Use dot-notation to specify where to find the text response and tool calls in the API
        response. For example, <code>data.reply</code> reads{' '}
        <code>{`response.data.reply`}</code>.
      </p>
      <p>
        If <code>tool_calls</code> path is omitted or the field is missing, Rivet operates in
        proposed-actions mode (text-only responses).
      </p>
    </PageLayout>
  );
}
