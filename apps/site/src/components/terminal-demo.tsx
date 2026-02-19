'use client';

import { useEffect, useState } from 'react';

const demoLines = [
  { text: '$ rivet init', color: 'text-gray-300', delay: 0 },
  { text: '  Initialized Rivet workspace:', color: 'text-green-400', delay: 600 },
  { text: '   + .rivet/config.json', color: 'text-green-400', delay: 800 },
  { text: '   + .rivet/permissions.json', color: 'text-green-400', delay: 1000 },
  { text: '   + .rivet/runs/', color: 'text-green-400', delay: 1200 },
  { text: '', color: '', delay: 1600 },
  { text: '$ rivet chat', color: 'text-gray-300', delay: 2000 },
  { text: '', color: '', delay: 2400 },
  { text: '  > Add error handling to server.ts', color: 'text-brand-400', delay: 2800 },
  { text: '', color: '', delay: 3200 },
  { text: '  Rivet:', color: 'text-brand-400', delay: 3600 },
  { text: '  I\'ll read the file first, then propose changes.', color: 'text-gray-400', delay: 3800 },
  { text: '', color: '', delay: 4200 },
  { text: '  [read_file] server.ts (42 lines)', color: 'text-gray-600', delay: 4600 },
  { text: '', color: '', delay: 5000 },
  { text: '  APPROVAL REQUIRED', color: 'text-yellow-400', delay: 5400 },
  { text: '  Action: Write file: server.ts', color: 'text-gray-300', delay: 5600 },
  { text: '  Risk:   [MEDIUM]', color: 'text-yellow-400', delay: 5800 },
  { text: '  + try {', color: 'text-green-400', delay: 6000 },
  { text: '  +   await startServer(config);', color: 'text-green-400', delay: 6200 },
  { text: '  + } catch (err) {', color: 'text-green-400', delay: 6400 },
  { text: '  +   logger.error("Server failed", err);', color: 'text-green-400', delay: 6600 },
  { text: '  + }', color: 'text-green-400', delay: 6800 },
  { text: '', color: '', delay: 7000 },
  { text: '  ? Approve this action? (y/N) y', color: 'text-gray-300', delay: 7400 },
  { text: '  File written: server.ts', color: 'text-green-400', delay: 7800 },
];

export function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    demoLines.forEach((line, i) => {
      const timer = setTimeout(() => {
        setVisibleLines(i + 1);
      }, line.delay);
      timers.push(timer);
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 shadow-2xl shadow-brand-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-2 text-xs text-gray-500 font-mono">rivet - ~/project</span>
      </div>
      <div className="p-5 font-mono text-sm leading-6 min-h-[420px]">
        {demoLines.slice(0, visibleLines).map((line, i) => (
          <div key={i} className={`${line.color} animate-fade-in`}>
            {line.text || '\u00A0'}
          </div>
        ))}
        {visibleLines < demoLines.length && (
          <span className="terminal-cursor text-gray-500">&nbsp;</span>
        )}
      </div>
    </div>
  );
}
