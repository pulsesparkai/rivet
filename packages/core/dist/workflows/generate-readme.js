"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReadme = void 0;
exports.generateReadme = {
    name: 'generate-readme',
    description: 'Generate or improve a README from the repository files',
    steps: [
        {
            description: 'Analyze project structure and key files',
            actions: [
                {
                    tool: 'list_dir',
                    args: { path: '.' },
                    description: 'List root directory to understand project structure',
                    risk: 'low',
                    requires_approval: false,
                },
                {
                    tool: 'read_file',
                    args: { path: 'package.json' },
                    description: 'Read package.json for project metadata',
                    risk: 'low',
                    requires_approval: false,
                },
            ],
        },
        {
            description: 'Generate README.md',
            actions: [
                {
                    tool: 'write_file',
                    args: { path: 'README.md', content: '' },
                    description: 'Write generated README.md',
                    risk: 'medium',
                    requires_approval: true,
                },
            ],
        },
    ],
};
