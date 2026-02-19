import { ProposedAction } from '@pulsespark/shared';

export const scaffoldNextjs = {
  name: 'scaffold-nextjs',
  description: 'Scaffold a new Next.js application with recommended defaults',
  steps: [
    {
      description: 'Create a new Next.js project with TypeScript and Tailwind CSS',
      actions: [
        {
          tool: 'run_command',
          args: {
            command: 'npx create-next-app@latest my-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"',
          },
          description: 'Run create-next-app with TypeScript, Tailwind, ESLint, App Router',
          risk: 'medium' as const,
          requires_approval: true,
        },
      ],
    },
  ],
};
