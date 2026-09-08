/** Strukturierter JSON-Logger mit Redaction (Spec 40). */
import { redact } from './errors';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MAX_FIELD = 2000;

function currentLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return (['debug', 'info', 'warn', 'error'] as const).includes(raw as LogLevel)
    ? (raw as LogLevel)
    : 'info';
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]';
  if (typeof value === 'string') {
    const clean = redact(value);
    return clean.length > MAX_FIELD ? `${clean.slice(0, MAX_FIELD)}…` : clean;
  }
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (/key|token|secret|password|authorization/i.test(k)) {
      out[k] = '[redacted]';
      continue;
    }
    out[k] = sanitize(v, depth + 1);
  }
  return out;
}

export interface LogFields {
  runId?: string;
  conversationId?: string;
  module?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

function write(level: LogLevel, msg: string, base: LogFields, fields?: LogFields): void {
  if (ORDER[level] < ORDER[currentLevel()]) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg: redact(msg),
    ...(sanitize({ ...base, ...fields }) as Record<string, unknown>),
  };
  let text: string;
  try {
    text = JSON.stringify(line);
  } catch {
    text = JSON.stringify({ ts: line.ts, level, msg: line.msg, note: 'unserializable fields' });
  }
  if (level === 'error' || level === 'warn') process.stderr.write(`${text}\n`);
  else process.stdout.write(`${text}\n`);
}

export function createLogger(base: LogFields = {}): Logger {
  return {
    debug: (m, f) => write('debug', m, base, f),
    info: (m, f) => write('info', m, base, f),
    warn: (m, f) => write('warn', m, base, f),
    error: (m, f) => write('error', m, base, f),
    child: (f) => createLogger({ ...base, ...f }),
  };
}

export const logger = createLogger();
