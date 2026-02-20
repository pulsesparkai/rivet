import { RunLog, RunAction } from '@pulsesparkai/shared';

export interface RunDiffResult {
  summary: string;
  metaDiffs: MetaDiff[];
  actionDiffs: ActionDiff[];
  stats: DiffStats;
}

export interface MetaDiff {
  field: string;
  left: string;
  right: string;
}

export interface ActionDiff {
  index: number;
  status: 'same' | 'added' | 'removed' | 'changed';
  left?: ActionSummary;
  right?: ActionSummary;
  details?: string;
}

export interface ActionSummary {
  type: string;
  tool?: string;
  timestamp: string;
  preview: string;
}

export interface DiffStats {
  totalLeft: number;
  totalRight: number;
  same: number;
  added: number;
  removed: number;
  changed: number;
  promptDelta: string;
}

function summarizeAction(action: RunAction): ActionSummary {
  const tool = (action.data.tool as string) || undefined;
  const content = (action.data.content as string) || (action.data.output as string) || '';
  const preview = content.length > 120 ? content.slice(0, 120) + '...' : content;

  return {
    type: action.type,
    tool,
    timestamp: action.timestamp,
    preview,
  };
}

function actionsEqual(a: RunAction, b: RunAction): boolean {
  if (a.type !== b.type) return false;
  const aKey = `${a.data.tool || ''}:${a.type}`;
  const bKey = `${b.data.tool || ''}:${b.type}`;
  return aKey === bKey;
}

export function diffRuns(left: RunLog, right: RunLog): RunDiffResult {
  const metaDiffs: MetaDiff[] = [];

  if (left.provider !== right.provider) {
    metaDiffs.push({ field: 'provider', left: left.provider, right: right.provider });
  }
  if (left.model !== right.model) {
    metaDiffs.push({ field: 'model', left: left.model, right: right.model });
  }
  if (left.task !== right.task) {
    metaDiffs.push({ field: 'task', left: left.task, right: right.task });
  }
  if (left.status !== right.status) {
    metaDiffs.push({ field: 'status', left: left.status, right: right.status });
  }

  const actionDiffs: ActionDiff[] = [];
  const maxLen = Math.max(left.actions.length, right.actions.length);
  let same = 0, added = 0, removed = 0, changed = 0;

  for (let i = 0; i < maxLen; i++) {
    const la = left.actions[i];
    const ra = right.actions[i];

    if (la && ra) {
      if (actionsEqual(la, ra)) {
        same++;
        actionDiffs.push({
          index: i,
          status: 'same',
          left: summarizeAction(la),
          right: summarizeAction(ra),
        });
      } else {
        changed++;
        actionDiffs.push({
          index: i,
          status: 'changed',
          left: summarizeAction(la),
          right: summarizeAction(ra),
          details: `${la.type}:${la.data.tool || '?'} -> ${ra.type}:${ra.data.tool || '?'}`,
        });
      }
    } else if (la && !ra) {
      removed++;
      actionDiffs.push({
        index: i,
        status: 'removed',
        left: summarizeAction(la),
      });
    } else if (!la && ra) {
      added++;
      actionDiffs.push({
        index: i,
        status: 'added',
        right: summarizeAction(ra),
      });
    }
  }

  const leftPromptLen = left.task.length;
  const rightPromptLen = right.task.length;
  const promptDelta = leftPromptLen === rightPromptLen
    ? 'same length'
    : `${leftPromptLen > rightPromptLen ? '-' : '+'}${Math.abs(rightPromptLen - leftPromptLen)} chars`;

  const summaryParts: string[] = [];
  if (metaDiffs.length > 0) summaryParts.push(`${metaDiffs.length} metadata change(s)`);
  if (changed > 0) summaryParts.push(`${changed} action(s) changed`);
  if (added > 0) summaryParts.push(`${added} action(s) added`);
  if (removed > 0) summaryParts.push(`${removed} action(s) removed`);
  if (summaryParts.length === 0) summaryParts.push('Runs are identical');

  return {
    summary: summaryParts.join(', '),
    metaDiffs,
    actionDiffs,
    stats: {
      totalLeft: left.actions.length,
      totalRight: right.actions.length,
      same,
      added,
      removed,
      changed,
      promptDelta,
    },
  };
}

export function formatDiff(diff: RunDiffResult, leftId: string, rightId: string): string {
  const lines: string[] = [];

  lines.push(`Run Diff: ${leftId.slice(0, 8)} vs ${rightId.slice(0, 8)}`);
  lines.push('='.repeat(60));
  lines.push(`Summary: ${diff.summary}`);
  lines.push('');

  if (diff.metaDiffs.length > 0) {
    lines.push('Metadata Changes:');
    for (const md of diff.metaDiffs) {
      lines.push(`  ${md.field}: "${md.left}" -> "${md.right}"`);
    }
    lines.push('');
  }

  lines.push(`Actions: ${diff.stats.totalLeft} (left) vs ${diff.stats.totalRight} (right)`);
  lines.push(`  same=${diff.stats.same} changed=${diff.stats.changed} added=${diff.stats.added} removed=${diff.stats.removed}`);
  lines.push(`  prompt delta: ${diff.stats.promptDelta}`);
  lines.push('');

  const notable = diff.actionDiffs.filter(a => a.status !== 'same');
  if (notable.length > 0) {
    lines.push('Action Changes:');
    for (const ad of notable) {
      const tag = ad.status === 'added' ? '+' : ad.status === 'removed' ? '-' : '~';
      const left = ad.left ? `${ad.left.type}${ad.left.tool ? ':' + ad.left.tool : ''}` : '';
      const right = ad.right ? `${ad.right.type}${ad.right.tool ? ':' + ad.right.tool : ''}` : '';

      if (ad.status === 'changed') {
        lines.push(`  ${tag} [${ad.index}] ${left} -> ${right}`);
      } else if (ad.status === 'added') {
        lines.push(`  ${tag} [${ad.index}] ${right}`);
      } else {
        lines.push(`  ${tag} [${ad.index}] ${left}`);
      }
    }
  }

  return lines.join('\n');
}
