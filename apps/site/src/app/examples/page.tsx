import { PageLayout } from '@/components/page-layout';

export default function ExamplesPage() {
  return (
    <PageLayout title="Examples" description="Common workflows you can run with Rivet.">
      <h2>1. Scaffold a Next.js project</h2>
      <p>
        Ask Rivet to create a new Next.js application with your preferred setup:
      </p>
      <pre><code>{`$ rivet run "Create a new Next.js app with TypeScript, Tailwind CSS, and App Router"

  Rivet:
  I'll scaffold a new Next.js project with your requirements.

  APPROVAL REQUIRED
  Action: Execute command
  Command: npx create-next-app@latest my-app --typescript --tailwind --eslint --app
  Risk:   [HIGH]
  ? Approve this action? (y/N) y

  Running command...
  Project created successfully.

  Task completed.`}</code></pre>

      <h2>2. SEO audit</h2>
      <p>
        Let Rivet analyze your project for SEO issues:
      </p>
      <pre><code>{`$ rivet run "Audit this project for basic SEO issues and write a report"

  Rivet:
  I'll scan for title tags, meta descriptions, and common SEO patterns.

  [search_in_files] Searching for <title> tags...
  [search_in_files] Searching for meta descriptions...
  [read_file] Reading package.json for project info...

  APPROVAL REQUIRED
  Action: Write file: seo-report.md
  Risk:   [MEDIUM]

  Diff:
  + # SEO Audit Report
  + ## Findings
  + - Missing meta description on 3 pages
  + - Title tags found on 5/8 pages
  + ...

  ? Approve this action? (y/N) y
  File written: seo-report.md

  Task completed.`}</code></pre>

      <h2>3. Generate or improve README</h2>
      <p>
        Have Rivet analyze your project structure and generate documentation:
      </p>
      <pre><code>{`$ rivet run "Generate a comprehensive README for this project"

  Rivet:
  I'll analyze the project structure and key files to create a README.

  [list_dir] Listing root directory...
  [read_file] Reading package.json...
  [read_file] Reading src/index.ts...

  APPROVAL REQUIRED
  Action: Write file: README.md
  Risk:   [MEDIUM]

  Diff:
  + # Project Name
  + > Description based on package.json
  +
  + ## Installation
  + \`\`\`bash
  + npm install
  + \`\`\`
  + ...

  ? Approve this action? (y/N) y
  File written: README.md

  Task completed.`}</code></pre>

      <h2>Interactive chat workflow</h2>
      <p>
        For more complex tasks, use interactive chat mode:
      </p>
      <pre><code>{`$ rivet chat

  > Refactor the user service to use dependency injection

  Rivet:
  Let me analyze the current user service implementation first.

  [read_file] src/services/user.ts
  [read_file] src/types/index.ts

  I can see the service has hardcoded database calls. Here's my plan:
  1. Extract a UserRepository interface
  2. Create a concrete implementation
  3. Modify UserService to accept the repository as a constructor parameter
  4. Update the service factory

  > /approve

  APPROVAL REQUIRED
  Action: Write file: src/types/user-repository.ts
  ...`}</code></pre>

      <h2>Dry run mode</h2>
      <p>
        See what Rivet would do without executing anything:
      </p>
      <pre><code>{`$ rivet run "add error handling to all API routes" --dry-run

  Rivet:
  [DRY RUN] I would:
  1. Read each file in src/routes/
  2. Add try-catch blocks around route handlers
  3. Add consistent error response formatting

  [DRY RUN] Actions that would be proposed:
  - write_file: src/routes/users.ts
  - write_file: src/routes/posts.ts
  - write_file: src/routes/auth.ts

  No actions were executed (dry run mode).`}</code></pre>
    </PageLayout>
  );
}
