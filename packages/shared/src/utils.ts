import * as crypto from 'crypto';
import { SECRET_PATTERNS } from './constants';

export function generateId(): string {
  return crypto.randomBytes(8).toString('hex');
}

export function timestamp(): string {
  return new Date().toISOString();
}

export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(new RegExp(pattern, 'g'), '[REDACTED]');
  }
  return result;
}

export function containsSecrets(text: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

export function interpolateEnvVars(template: string): string {
  return template.replace(/\$\{(\w+)\}/g, (_, varName) => {
    return process.env[varName] || '';
  });
}

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

const ZERO_WIDTH_RE = /[\u200B\u200C\u200D\uFEFF\u2060]/g;
const BIDI_OVERRIDE_RE = /[\u202A-\u202E\u2066-\u2069]/g;

export function normalizeInput(text: string): string {
  let result = text.trim();
  result = result.normalize('NFKC');
  result = result.replace(ZERO_WIDTH_RE, '');
  result = result.replace(BIDI_OVERRIDE_RE, '');
  return result;
}

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
];

const PRIVATE_HOSTS = new Set([
  'localhost',
  '::1',
  '0.0.0.0',
  '[::1]',
]);

export function isPrivateIP(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (PRIVATE_HOSTS.has(lower)) return true;
  return PRIVATE_RANGES.some((re) => re.test(lower));
}
