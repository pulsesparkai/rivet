import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { TerminalDemo } from '@/components/terminal-demo';
import Link from 'next/link';

const features = [
  {
    title: 'Security-First',
    description: 'Default deny for writes and commands. Workspace sandboxing. Approval gates for every risky action. Secrets firewall built in.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: 'Any LLM Provider',
    description: 'OpenAI-compatible, Anthropic native, or any custom HTTP API. Pluggable provider adapters. No vendor lock-in.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.814a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
      </svg>
    ),
  },
  {
    title: 'Diff-Based Writes',
    description: 'Every file change shows a clear diff for review before it touches your code. No surprises.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    title: 'Full Audit Trail',
    description: 'Every run logged with tasks, plans, approvals, tool calls, and results. Replay and inspect any session.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
  },
  {
    title: 'Local Execution',
    description: 'Everything runs on your machine. Your code never leaves your workspace. Only LLM API calls go to the network.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
      </svg>
    ),
  },
  {
    title: 'Interactive Chat',
    description: 'Full conversational agent in your terminal. Plan, discuss, review, and approve actions in real time.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <Nav />

      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm font-medium mb-6">
                <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                v0.1 - Open Source
              </div>

              <h1 className="text-5xl sm:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6">
                Agentic workflows{' '}
                <span className="gradient-text">from your terminal</span>
              </h1>

              <p className="text-lg text-gray-400 leading-relaxed mb-8 max-w-lg">
                Rivet is a security-first, provider-agnostic CLI agent that plans tasks, proposes
                actions with diff previews, and executes only what you approve. Every run is logged
                for audit and replay.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/install"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium transition-all hover:shadow-lg hover:shadow-brand-500/20"
                >
                  Get Started
                </Link>
                <Link
                  href="/docs"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors border border-gray-700"
                >
                  Documentation
                </Link>
              </div>

              <div className="mt-8 code-block text-sm">
                <span className="text-gray-500">$</span>{' '}
                <span className="text-brand-400">npm i -g @pulsesparkai/rivet</span>
                <br />
                <span className="text-gray-500">$</span>{' '}
                <span className="text-brand-400">rivet init</span>
                <br />
                <span className="text-gray-500">$</span>{' '}
                <span className="text-brand-400">rivet chat</span>
              </div>
            </div>

            <div className="animate-fade-in-delay">
              <TerminalDemo />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 border-t border-gray-800/60">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Built for developers who care about control
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              No magic. No hidden API calls. Every action is transparent, approvable, and auditable.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl border border-gray-800 bg-gray-900/40 hover:bg-gray-900/60 hover:border-gray-700 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400 mb-4 group-hover:bg-brand-500/20 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 border-t border-gray-800/60">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-gray-400 mb-8">
            Install Rivet in seconds and start running agentic workflows from your terminal.
          </p>
          <div className="code-block text-left max-w-md mx-auto mb-8">
            <p><span className="text-gray-500">$</span> <span className="text-brand-400">npm i -g @pulsesparkai/rivet</span></p>
            <p><span className="text-gray-500">$</span> <span className="text-brand-400">rivet init</span></p>
            <p><span className="text-gray-500">$</span> <span className="text-brand-400">rivet run &quot;add tests to utils.ts&quot;</span></p>
          </div>
          <Link
            href="/install"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium transition-all hover:shadow-lg hover:shadow-brand-500/20"
          >
            View Installation Guide
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
