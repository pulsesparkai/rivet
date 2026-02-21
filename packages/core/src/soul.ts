import * as fs from 'fs';
import * as path from 'path';
import { RIVET_DIR, SOUL_FILE, SOUL_TEMPLATE, containsSecrets, redactSecrets } from '@pulsesparkai/shared';

export function soulPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, RIVET_DIR, SOUL_FILE);
}

export function hasSoul(workspaceRoot: string): boolean {
  return fs.existsSync(soulPath(workspaceRoot));
}

export function createSoul(workspaceRoot: string): string {
  const p = soulPath(workspaceRoot);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(p, SOUL_TEMPLATE, 'utf-8');
  return p;
}

export function loadSoul(workspaceRoot: string): string | null {
  const p = soulPath(workspaceRoot);
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

export function loadSoulSafe(workspaceRoot: string): { content: string; hadSecrets: boolean } | null {
  const raw = loadSoul(workspaceRoot);
  if (!raw) return null;

  const hadSecrets = containsSecrets(raw);
  const content = hadSecrets ? redactSecrets(raw) : raw;
  return { content, hadSecrets };
}

export function summarizeSoul(raw: string, maxLines = 12): string {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !l.startsWith('#'))
    .filter((l) => {
      const stripped = l.replace(/^-\s*/, '').replace(/:$/, '').trim();
      return stripped.length > 0;
    });

  return lines.slice(0, maxLines).join('\n');
}
