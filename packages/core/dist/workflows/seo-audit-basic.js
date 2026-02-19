"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seoAuditBasic = void 0;
exports.seoAuditBasic = {
    name: 'seo-audit-basic',
    description: 'Generate a basic SEO audit report by analyzing project files',
    steps: [
        {
            description: 'Scan HTML and meta tags in the project',
            actions: [
                {
                    tool: 'search_in_files',
                    args: { query: '<title>', globs: '**/*.{html,tsx,jsx}' },
                    description: 'Search for title tags across the project',
                    risk: 'low',
                    requires_approval: false,
                },
                {
                    tool: 'search_in_files',
                    args: { query: 'meta.*description', globs: '**/*.{html,tsx,jsx}' },
                    description: 'Search for meta description tags',
                    risk: 'low',
                    requires_approval: false,
                },
            ],
        },
        {
            description: 'Generate SEO report',
            actions: [
                {
                    tool: 'write_file',
                    args: { path: 'seo-report.md', content: '' },
                    description: 'Write SEO audit report to seo-report.md',
                    risk: 'medium',
                    requires_approval: true,
                },
            ],
        },
    ],
};
