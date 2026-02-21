import * as http from 'http';
import * as fs from 'fs';
import * as pathMod from 'path';
import {
  RunLogger,
  loadPermissions,
  savePermissions,
  diffRuns,
  listWorkflows,
  BUILTIN_WORKFLOWS,
} from '@pulsesparkai/core';
import { loadConfig, saveConfig } from '@pulsesparkai/providers';
import type { RunLog, PermissionsConfig, RivetConfig } from '@pulsesparkai/shared';
import type { ExecutionTrace } from '@pulsesparkai/core';

type Handler = (req: http.IncomingMessage, res: http.ServerResponse, workspaceRoot: string) => void;

const routes: Record<string, Handler> = {
  'GET /api/stats': handleGetStats,
  'GET /api/runs': handleGetRuns,
  'DELETE /api/runs': handleDeleteAllRuns,
  'GET /api/config': handleGetConfig,
  'PUT /api/config': handlePutConfig,
  'GET /api/permissions': handleGetPermissions,
  'PUT /api/permissions': handlePutPermissions,
  'GET /api/workflows': handleGetWorkflows,
};

export function handleApiRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  workspaceRoot: string
): void {
  const method = req.method || 'GET';
  const url = req.url || '';

  const diffMatch = url.match(/^\/api\/runs\/diff\/([^/]+)\/([^/]+)$/);
  if (diffMatch && method === 'GET') {
    handleRunDiff(req, res, workspaceRoot, diffMatch[1], diffMatch[2]);
    return;
  }

  const traceMatch = url.match(/^\/api\/runs\/([^/]+)\/trace$/);
  if (traceMatch && method === 'GET') {
    handleGetTrace(req, res, workspaceRoot, traceMatch[1]);
    return;
  }

  const runMatch = url.match(/^\/api\/runs\/(.+)$/);
  if (runMatch && method === 'GET') {
    handleGetRunById(req, res, workspaceRoot, runMatch[1]);
    return;
  }
  if (runMatch && method === 'DELETE') {
    handleDeleteRun(req, res, workspaceRoot, runMatch[1]);
    return;
  }

  if (url.startsWith('/api/preview') && method === 'GET') {
    handlePreview(req, res, workspaceRoot);
    return;
  }

  const routeKey = `${method} ${url.split('?')[0]}`;
  const handler = routes[routeKey];

  if (handler) {
    handler(req, res, workspaceRoot);
  } else {
    json(res, 404, { error: 'Not found' });
  }
}

function json(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function handleGetStats(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  workspaceRoot: string
): void {
  try {
    const runs = RunLogger.listRuns(workspaceRoot);
    const completed = runs.filter((r: RunLog) => r.status === 'completed').length;
    const failed = runs.filter((r: RunLog) => r.status === 'failed').length;

    let totalTools = 0;
    let totalApprovals = 0;
    for (const run of runs) {
      for (const action of run.actions) {
        if (action.type === 'tool_call') totalTools++;
        if (action.type === 'approval_response') totalApprovals++;
      }
    }

    json(res, 200, {
      total_runs: runs.length,
      completed,
      failed,
      running: runs.filter((r: RunLog) => r.status === 'running').length,
      success_rate: runs.length > 0 ? Math.round((completed / runs.length) * 100) : 0,
      total_tool_calls: totalTools,
      total_approvals: totalApprovals,
    });
  } catch {
    json(res, 200, {
      total_runs: 0, completed: 0, failed: 0, running: 0,
      success_rate: 0, total_tool_calls: 0, total_approvals: 0,
    });
  }
}

function handleGetRuns(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  workspaceRoot: string
): void {
  try {
    const runs = RunLogger.listRuns(workspaceRoot);
    const summaries = runs.map((r: RunLog) => ({
      id: r.id,
      timestamp: r.timestamp,
      task: r.task,
      provider: r.provider,
      model: r.model,
      status: r.status,
      action_count: r.actions.length,
      summary: r.summary,
    }));
    json(res, 200, summaries);
  } catch {
    json(res, 200, []);
  }
}

function handleGetRunById(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  workspaceRoot: string,
  id: string
): void {
  const run = RunLogger.getRunById(workspaceRoot, id);
  if (!run) {
    json(res, 404, { error: 'Run not found' });
    return;
  }
  json(res, 200, run);
}

function handleGetConfig(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  workspaceRoot: string
): void {
  try {
    const config = loadConfig(workspaceRoot);
    json(res, 200, config);
  } catch {
    json(res, 200, { provider: '', model: '', api_key_env: '' });
  }
}

function looksLikeActualKey(value: string): boolean {
  if (!value) return false;
  const v = value.trim();
  return v.startsWith('sk-') || v.startsWith('key-') || v.startsWith('Bearer ') || v.length > 50;
}

async function handlePutConfig(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  workspaceRoot: string
): Promise<void> {
  try {
    const body = await readBody(req);
    const config = JSON.parse(body) as RivetConfig;

    if (config.api_key_env && looksLikeActualKey(config.api_key_env)) {
      json(res, 400, {
        error: 'The api_key_env field should be an environment variable name (e.g. ANTHROPIC_API_KEY), not the actual API key. Set the key in your terminal with: export ANTHROPIC_API_KEY="sk-..."',
      });
      return;
    }

    saveConfig(workspaceRoot, config);
    json(res, 200, { ok: true });
  } catch (err) {
    json(res, 400, { error: err instanceof Error ? err.message : 'Invalid config' });
  }
}

function handleGetPermissions(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  workspaceRoot: string
): void {
  try {
    const perms = loadPermissions(workspaceRoot);
    json(res, 200, perms);
  } catch {
    json(res, 200, {});
  }
}

function handleDeleteRun(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  workspaceRoot: string,
  id: string
): void {
  const deleted = RunLogger.deleteRun(workspaceRoot, id);
  if (deleted) {
    json(res, 200, { ok: true });
  } else {
    json(res, 404, { error: 'Run not found' });
  }
}

function handleDeleteAllRuns(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  workspaceRoot: string
): void {
  const count = RunLogger.deleteAllRuns(workspaceRoot);
  json(res, 200, { ok: true, deleted: count });
}

const PREVIEW_MIME: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function handlePreview(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  workspaceRoot: string
): void {
  const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
  const filePath = urlObj.searchParams.get('file');
  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Missing file parameter');
    return;
  }

  const resolved = pathMod.resolve(workspaceRoot, filePath);
  if (!resolved.startsWith(workspaceRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Path outside workspace');
    return;
  }

  if (!fs.existsSync(resolved)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found: ' + filePath);
    return;
  }

  const ext = pathMod.extname(resolved);
  const contentType = PREVIEW_MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(fs.readFileSync(resolved));
}

async function handlePutPermissions(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  workspaceRoot: string
): Promise<void> {
  try {
    const body = await readBody(req);
    const perms = JSON.parse(body) as PermissionsConfig;
    savePermissions(workspaceRoot, perms);
    json(res, 200, { ok: true });
  } catch (err) {
    json(res, 400, { error: err instanceof Error ? err.message : 'Invalid permissions' });
  }
}

function handleRunDiff(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  workspaceRoot: string,
  id1: string,
  id2: string
): void {
  const left = RunLogger.getRunById(workspaceRoot, id1);
  const right = RunLogger.getRunById(workspaceRoot, id2);

  if (!left) { json(res, 404, { error: `Run not found: ${id1}` }); return; }
  if (!right) { json(res, 404, { error: `Run not found: ${id2}` }); return; }

  const result = diffRuns(left, right);
  json(res, 200, { left: id1, right: id2, ...result });
}

function handleGetTrace(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  workspaceRoot: string,
  id: string
): void {
  const run = RunLogger.getRunById(workspaceRoot, id);
  if (!run) { json(res, 404, { error: 'Run not found' }); return; }

  const tracePath = pathMod.join(workspaceRoot, '.rivet', 'runs', `${run.id}.trace.json`);
  if (!fs.existsSync(tracePath)) {
    json(res, 404, { error: 'No execution trace for this run' });
    return;
  }

  try {
    const trace = JSON.parse(fs.readFileSync(tracePath, 'utf-8')) as ExecutionTrace;
    json(res, 200, trace);
  } catch {
    json(res, 500, { error: 'Failed to read trace' });
  }
}

function handleGetWorkflows(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  workspaceRoot: string
): void {
  const custom = listWorkflows(workspaceRoot);
  json(res, 200, {
    builtin: BUILTIN_WORKFLOWS.map(w => ({ name: w.name, description: w.description, steps: w.steps.length })),
    custom: custom.map(w => ({ name: w.name, description: w.description, steps: w.steps.length })),
  });
}
