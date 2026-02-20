import * as fs from 'fs';
import * as path from 'path';
import { RIVET_DIR } from '@pulsesparkai/shared';

const WORKFLOWS_DIR = 'workflows';

export interface WorkflowStep {
  name: string;
  prompt: string;
  requires_approval?: boolean;
  on_failure?: 'stop' | 'skip' | 'retry';
  max_retries?: number;
  output_var?: string;
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  version?: string;
  parameters?: Record<string, { description: string; required?: boolean; default?: string }>;
  steps: WorkflowStep[];
}

export interface WorkflowRunState {
  workflowName: string;
  parameters: Record<string, string>;
  currentStep: number;
  totalSteps: number;
  status: 'running' | 'completed' | 'failed' | 'paused';
  outputs: Record<string, string>;
  stepResults: StepResult[];
  startedAt: string;
  finishedAt?: string;
}

export interface StepResult {
  stepName: string;
  status: 'completed' | 'failed' | 'skipped';
  output: string;
  error?: string;
  retries: number;
  durationMs: number;
}

export function loadWorkflow(workspaceRoot: string, name: string): WorkflowDefinition | null {
  const yamlPath = path.join(workspaceRoot, RIVET_DIR, WORKFLOWS_DIR, `${name}.json`);
  if (!fs.existsSync(yamlPath)) return null;

  try {
    const raw = fs.readFileSync(yamlPath, 'utf-8');
    return JSON.parse(raw) as WorkflowDefinition;
  } catch {
    return null;
  }
}

export function listWorkflows(workspaceRoot: string): WorkflowDefinition[] {
  const dir = path.join(workspaceRoot, RIVET_DIR, WORKFLOWS_DIR);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
        return JSON.parse(raw) as WorkflowDefinition;
      } catch {
        return null;
      }
    })
    .filter((w): w is WorkflowDefinition => w !== null);
}

export function saveWorkflow(workspaceRoot: string, workflow: WorkflowDefinition): void {
  const dir = path.join(workspaceRoot, RIVET_DIR, WORKFLOWS_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, `${workflow.name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
}

function interpolateParams(template: string, params: Record<string, string>, outputs: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  }
  for (const [key, value] of Object.entries(outputs)) {
    result = result.replace(new RegExp(`\\$\\{output\\.${key}\\}`, 'g'), value);
  }
  return result;
}

export class WorkflowRunner {
  private state: WorkflowRunState;
  private workflow: WorkflowDefinition;
  private executeStep: (prompt: string, stepName: string) => Promise<string>;
  private onApproval: (step: WorkflowStep) => Promise<boolean>;
  private onProgress: (state: WorkflowRunState) => void;

  constructor(opts: {
    workflow: WorkflowDefinition;
    parameters: Record<string, string>;
    executeStep: (prompt: string, stepName: string) => Promise<string>;
    onApproval: (step: WorkflowStep) => Promise<boolean>;
    onProgress: (state: WorkflowRunState) => void;
  }) {
    this.workflow = opts.workflow;
    this.executeStep = opts.executeStep;
    this.onApproval = opts.onApproval;
    this.onProgress = opts.onProgress;

    this.state = {
      workflowName: opts.workflow.name,
      parameters: opts.parameters,
      currentStep: 0,
      totalSteps: opts.workflow.steps.length,
      status: 'running',
      outputs: {},
      stepResults: [],
      startedAt: new Date().toISOString(),
    };
  }

  async run(): Promise<WorkflowRunState> {
    this.onProgress(this.state);

    for (let i = 0; i < this.workflow.steps.length; i++) {
      this.state.currentStep = i + 1;
      const step = this.workflow.steps[i];

      if (step.requires_approval) {
        const approved = await this.onApproval(step);
        if (!approved) {
          this.state.status = 'paused';
          this.onProgress(this.state);
          return this.state;
        }
      }

      const prompt = interpolateParams(step.prompt, this.state.parameters, this.state.outputs);
      const maxRetries = step.max_retries || 0;
      const onFailure = step.on_failure || 'stop';
      let lastError = '';
      let succeeded = false;
      let retries = 0;
      let output = '';
      const startMs = Date.now();

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          output = await this.executeStep(prompt, step.name);
          succeeded = true;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          retries = attempt + 1;
        }
      }

      const durationMs = Date.now() - startMs;

      if (succeeded) {
        if (step.output_var) {
          this.state.outputs[step.output_var] = output;
        }
        this.state.stepResults.push({
          stepName: step.name,
          status: 'completed',
          output: output.slice(0, 2000),
          retries,
          durationMs,
        });
      } else {
        if (onFailure === 'skip') {
          this.state.stepResults.push({
            stepName: step.name,
            status: 'skipped',
            output: '',
            error: lastError,
            retries,
            durationMs,
          });
        } else {
          this.state.stepResults.push({
            stepName: step.name,
            status: 'failed',
            output: '',
            error: lastError,
            retries,
            durationMs,
          });
          this.state.status = 'failed';
          this.state.finishedAt = new Date().toISOString();
          this.onProgress(this.state);
          return this.state;
        }
      }

      this.onProgress(this.state);
    }

    this.state.status = 'completed';
    this.state.finishedAt = new Date().toISOString();
    this.onProgress(this.state);
    return this.state;
  }

  getState(): WorkflowRunState {
    return { ...this.state };
  }
}

export const BUILTIN_WORKFLOWS: WorkflowDefinition[] = [
  {
    name: 'hunt-leads',
    description: 'Search for businesses, extract leads, draft outreach emails',
    parameters: {
      city: { description: 'Target city', required: true },
      industry: { description: 'Target industry', required: true },
      count: { description: 'Number of leads to find', default: '10' },
    },
    steps: [
      {
        name: 'search',
        prompt: 'Use fetch_url and search tools to find ${count} ${industry} businesses in ${city}. Return a list of business names, addresses, and any contact info you can find. Focus on businesses with websites.',
        output_var: 'leads_raw',
      },
      {
        name: 'extract',
        prompt: 'From the raw search results below, extract structured lead data. For each business, capture: name, address, phone, website, email (if available).\n\nRaw data:\n${output.leads_raw}\n\nFormat as a clean list.',
        output_var: 'leads_structured',
      },
      {
        name: 'save',
        prompt: 'Save the following structured leads to a file called "leads-${city}-${industry}.md" in the workspace root:\n\n${output.leads_structured}',
        requires_approval: true,
      },
      {
        name: 'draft-outreach',
        prompt: 'Draft a professional outreach email template for ${industry} businesses in ${city}. The email should be: concise (under 150 words), personalized with {{business_name}} placeholder, have a clear call-to-action. Save to "outreach-template-${city}-${industry}.md".',
        requires_approval: true,
        output_var: 'outreach_template',
      },
    ],
  },
  {
    name: 'code-review',
    description: 'Comprehensive code review of recent changes',
    parameters: {
      branch: { description: 'Branch to review', default: 'HEAD' },
    },
    steps: [
      {
        name: 'gather-changes',
        prompt: 'Run git diff to see all recent changes. Run git log --oneline -5 to see recent commits. List all modified files.',
        output_var: 'changes',
      },
      {
        name: 'analyze-quality',
        prompt: 'Review the code changes below for quality issues:\n${output.changes}\n\nCheck for: bugs, security issues, performance problems, missing error handling, code style issues. Be specific with file names and line numbers.',
        output_var: 'quality_report',
      },
      {
        name: 'check-tests',
        prompt: 'Check if the changes have adequate test coverage. Run check_errors to verify the code compiles. Identify any missing test cases.',
        output_var: 'test_report',
      },
      {
        name: 'save-report',
        prompt: 'Create a comprehensive code review report in "code-review-report.md" combining:\n\n## Quality Analysis\n${output.quality_report}\n\n## Test Coverage\n${output.test_report}\n\nInclude severity ratings (critical/warning/info) for each finding.',
        requires_approval: true,
      },
    ],
  },
  {
    name: 'refactor',
    description: 'Systematic refactoring with safety checks',
    parameters: {
      target: { description: 'File or pattern to refactor', required: true },
      goal: { description: 'What the refactoring should achieve', required: true },
    },
    steps: [
      {
        name: 'analyze',
        prompt: 'Analyze ${target} and understand its current structure. Read the file(s), identify dependencies, and create a refactoring plan for: ${goal}',
        output_var: 'plan',
      },
      {
        name: 'snapshot',
        prompt: 'Run git_status and git_diff to capture the current state. Run check_errors to establish a baseline — record any pre-existing errors.',
        output_var: 'baseline',
      },
      {
        name: 'execute',
        prompt: 'Execute the refactoring plan:\n${output.plan}\n\nUse str_replace for precise edits. After each file change, run check_errors.',
        requires_approval: true,
        on_failure: 'stop',
      },
      {
        name: 'verify',
        prompt: 'Verify the refactoring is complete: run check_errors, compare against baseline errors:\n${output.baseline}\n\nMake sure no new errors were introduced.',
        output_var: 'verification',
      },
    ],
  },
];
