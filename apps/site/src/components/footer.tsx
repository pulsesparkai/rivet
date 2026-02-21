import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-gray-800/60 bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-brand-500 to-teal-500 flex items-center justify-center text-white font-bold text-xs">
                R
              </div>
              <span className="font-semibold text-white">Rivet</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              Agentic workflows from your terminal. Built by PulseSpark.ai
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Product</h4>
            <ul className="space-y-2">
              <li><Link href="/install" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Install</Link></li>
              <li><Link href="/docs" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Documentation</Link></li>
              <li><Link href="/examples" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Examples</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Security</h4>
            <ul className="space-y-2">
              <li><Link href="/security" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Security Model</Link></li>
              <li><Link href="/providers" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Providers</Link></li>
              <li><Link href="/changelog" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Changelog</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Community</h4>
            <ul className="space-y-2">
              <li><a href="https://github.com/pulsesparkai/rivet" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">GitHub</a></li>
              <li><a href="https://github.com/pulsesparkai/rivet/issues" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Issues</a></li>
              <li><a href="https://github.com/pulsesparkai/rivet/discussions" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Discussions</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-800/60 text-center">
          <p className="text-sm text-gray-600">
            MIT License. Built with care by PulseSpark.ai
          </p>
        </div>
      </div>
    </footer>
  );
}
