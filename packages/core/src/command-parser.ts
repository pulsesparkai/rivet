export interface CommandAnalysis {
  safe: boolean;
  reasons: string[];
  risk: 'low' | 'medium' | 'high' | 'critical';
}

const RISK_PATTERNS: Array<{ pattern: RegExp; reason: string; risk: CommandAnalysis['risk'] }> = [
  { pattern: /\$\([^)]+\)/, reason: 'Contains $() command substitution', risk: 'high' },
  { pattern: /`[^`]+`/, reason: 'Contains backtick command substitution', risk: 'high' },
  { pattern: /\|\s*(ba)?sh\b/, reason: 'Pipes output to shell interpreter', risk: 'critical' },
  { pattern: /\|\s*zsh\b/, reason: 'Pipes output to shell interpreter', risk: 'critical' },
  { pattern: /\beval\b/, reason: 'Uses eval to execute dynamic code', risk: 'critical' },
  { pattern: /\bbase64\s+(-d|--decode)/, reason: 'Decodes base64 (possible obfuscation)', risk: 'high' },
  { pattern: /\b(python[23]?|perl|ruby|node|php)\s+-[ec]\b/, reason: 'Executes inline code via interpreter', risk: 'high' },
  { pattern: />\s*\/(?:etc|dev|sys|proc|boot)/, reason: 'Redirects to system path', risk: 'critical' },
  { pattern: /\benv\b[^;|&]*=.*\b(sh|bash|zsh)\b/, reason: 'Environment manipulation with shell exec', risk: 'high' },
  { pattern: /\bnohup\b/, reason: 'Spawns detached background process', risk: 'medium' },
  { pattern: /\bxargs\b.*\b(rm|mv|dd|mkfs)\b/, reason: 'Pipes to destructive command via xargs', risk: 'critical' },
  { pattern: /\bchmod\s+[0-7]*[2367][0-7]*\s+\//, reason: 'Changes permissions on system paths', risk: 'critical' },
  { pattern: /\bchown\b.*\//, reason: 'Changes ownership on system paths', risk: 'high' },
];

const NETWORK_PATTERN = /\b(curl|wget|ssh|scp|sftp|rsync|ftp|nc|netcat|telnet|nmap)\b/;

export function analyzeCommand(command: string): CommandAnalysis {
  const reasons: string[] = [];
  let maxRisk: CommandAnalysis['risk'] = 'low';

  const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

  for (const { pattern, reason, risk } of RISK_PATTERNS) {
    if (pattern.test(command)) {
      reasons.push(reason);
      if (riskOrder[risk] > riskOrder[maxRisk]) {
        maxRisk = risk;
      }
    }
  }

  return {
    safe: maxRisk !== 'critical',
    reasons,
    risk: maxRisk,
  };
}

export function isNetworkCommand(command: string): boolean {
  return NETWORK_PATTERN.test(command);
}
