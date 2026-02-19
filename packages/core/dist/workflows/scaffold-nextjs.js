"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scaffoldNextjs = void 0;
exports.scaffoldNextjs = {
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
                    risk: 'medium',
                    requires_approval: true,
                },
            ],
        },
    ],
};
