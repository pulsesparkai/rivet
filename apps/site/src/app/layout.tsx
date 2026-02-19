import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rivet by PulseSpark.ai - Agentic workflows from your terminal',
  description: 'A security-first, provider-agnostic agentic CLI that runs locally. Plan tasks, propose actions, execute with approval gates, and audit every run.',
  keywords: ['CLI', 'agent', 'AI', 'terminal', 'agentic', 'workflows', 'LLM', 'developer tools'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
