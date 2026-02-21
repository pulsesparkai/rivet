export const seoAuditBasic = {
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
          risk: 'low' as const,
          requires_approval: false,
        },
        {
          tool: 'search_in_files',
          args: { query: 'meta.*description', globs: '**/*.{html,tsx,jsx}' },
          description: 'Search for meta description tags',
          risk: 'low' as const,
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
          risk: 'medium' as const,
          requires_approval: true,
        },
      ],
    },
  ],
};
