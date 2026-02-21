const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?prior\s+(instructions|prompts)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /you\s+are\s+now\s+(?:a|an)\s+/i,
  /new\s+system\s+prompt\s*:/i,
  /system\s*:\s*you\s+are/i,
  /\[system\]\s*you\s+are/i,
  /forget\s+(everything|all)\s+(you|about)/i,
  /override\s+(your|the)\s+(instructions|rules|system)/i,
  /act\s+as\s+if\s+you\s+(have\s+)?no\s+(restrictions|rules|limits)/i,
  /pretend\s+(you\s+are|to\s+be)\s+/i,
  /jailbreak/i,
  /do\s+anything\s+now/i,
  /DAN\s+mode/i,
  /\bDAN\b.*\bprompt/i,
  /developer\s+mode\s+(enabled|activated|on)/i,
];

const EXFILTRATION_PATTERNS = [
  /send\s+(this|the|all|my)\s+(data|content|file|secret|key|password|token)/i,
  /curl\s+.*\s+http/i,
  /wget\s+.*\s+http/i,
  /fetch\s*\(\s*['"]https?:\/\//i,
  /base64\s+(encode|decode)\s+.*\s+(send|post|curl)/i,
];

export interface ContentGuardResult {
  safe: boolean;
  threats: ContentThreat[];
}

export interface ContentThreat {
  type: 'prompt_injection' | 'data_exfiltration' | 'suspicious_encoding' | 'unicode_obfuscation';
  severity: 'low' | 'medium' | 'high';
  pattern: string;
  match: string;
  position: number;
}

export function scanContent(content: string): ContentGuardResult {
  const threats: ContentThreat[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      threats.push({
        type: 'prompt_injection',
        severity: 'high',
        pattern: pattern.source,
        match: match[0],
        position: match.index || 0,
      });
    }
  }

  for (const pattern of EXFILTRATION_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      threats.push({
        type: 'data_exfiltration',
        severity: 'high',
        pattern: pattern.source,
        match: match[0],
        position: match.index || 0,
      });
    }
  }

  const b64Blocks = content.match(/[A-Za-z0-9+/=]{100,}/g);
  if (b64Blocks) {
    for (const block of b64Blocks) {
      try {
        const decoded = Buffer.from(block, 'base64').toString('utf-8');
        const hasInjection = INJECTION_PATTERNS.some(p => p.test(decoded));
        if (hasInjection) {
          threats.push({
            type: 'suspicious_encoding',
            severity: 'medium',
            pattern: 'base64-encoded injection',
            match: block.slice(0, 40) + '...',
            position: content.indexOf(block),
          });
        }
      } catch {
        continue;
      }
    }
  }

  return {
    safe: threats.length === 0,
    threats,
  };
}

export function sanitizeForContext(content: string, source: string): string {
  const result = scanContent(content);

  if (result.safe) {
    return `[Source: ${source}]\n${content}`;
  }

  let sanitized = content;
  for (const threat of result.threats) {
    if (threat.type === 'prompt_injection') {
      sanitized = sanitized.replace(threat.match, '[BLOCKED: prompt injection attempt]');
    } else if (threat.type === 'data_exfiltration') {
      sanitized = sanitized.replace(threat.match, '[BLOCKED: data exfiltration attempt]');
    }
  }

  const warning = `[Content Guard: ${result.threats.length} threat(s) neutralized from ${source}]`;
  return `${warning}\n${sanitized}`;
}

export interface ToolScope {
  tool: string;
  mode: 'allowed' | 'approval_required' | 'blocked';
  reason?: string;
}

export function evaluateToolScope(
  toolName: string,
  toolArgs: Record<string, unknown>,
  untrustedContentInContext: boolean
): ToolScope {
  if (!untrustedContentInContext) {
    return { tool: toolName, mode: 'allowed' };
  }

  const dangerousInUntrustedContext = new Set([
    'run_command', 'write_file', 'str_replace', 'git_commit', 'fetch_url',
  ]);

  if (dangerousInUntrustedContext.has(toolName)) {
    return {
      tool: toolName,
      mode: 'approval_required',
      reason: `Tool "${toolName}" requires extra approval — untrusted content is in the conversation context`,
    };
  }

  return { tool: toolName, mode: 'allowed' };
}

export function scanToolOutput(output: string, toolName: string): ContentGuardResult {
  return scanContent(output);
}

const ZERO_WIDTH_RE = /[\u200B\u200C\u200D\uFEFF\u2060]/g;
const BIDI_OVERRIDE_RE = /[\u202A-\u202E\u2066-\u2069]/g;

export function normalizeUnicode(text: string): string {
  let result = text.normalize('NFKC');
  result = result.replace(ZERO_WIDTH_RE, '');
  result = result.replace(BIDI_OVERRIDE_RE, '');
  return result;
}

export interface UserInputScanResult {
  safe: boolean;
  threats: ContentThreat[];
  truncated: boolean;
  normalized: string;
}

export function scanUserInput(input: string, maxLength: number): UserInputScanResult {
  const truncated = input.length > maxLength;
  const bounded = truncated ? input.slice(0, maxLength) : input;

  const normalized = normalizeUnicode(bounded);
  const hadObfuscation = ZERO_WIDTH_RE.test(bounded) || BIDI_OVERRIDE_RE.test(bounded);

  const threats: ContentThreat[] = [];

  if (hadObfuscation) {
    threats.push({
      type: 'unicode_obfuscation',
      severity: 'medium',
      pattern: 'zero-width or bidirectional override characters',
      match: '[hidden unicode characters detected]',
      position: 0,
    });
  }

  for (const pattern of INJECTION_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      threats.push({
        type: 'prompt_injection',
        severity: 'high',
        pattern: pattern.source,
        match: match[0],
        position: match.index || 0,
      });
    }
  }

  for (const pattern of EXFILTRATION_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      threats.push({
        type: 'data_exfiltration',
        severity: 'high',
        pattern: pattern.source,
        match: match[0],
        position: match.index || 0,
      });
    }
  }

  const rawNormalized = bounded.normalize('NFKC');
  if (rawNormalized !== bounded) {
    for (const pattern of INJECTION_PATTERNS) {
      const match = rawNormalized.match(pattern);
      if (match && !normalized.match(pattern)) {
        threats.push({
          type: 'unicode_obfuscation',
          severity: 'high',
          pattern: `homoglyph-obfuscated: ${pattern.source}`,
          match: match[0],
          position: match.index || 0,
        });
      }
    }
  }

  return {
    safe: threats.length === 0,
    threats,
    truncated,
    normalized,
  };
}
