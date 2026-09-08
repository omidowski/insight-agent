/** Fehlerregime: Normalisierung, Nutzermeldungen, Retry (Spec 38). */
import { newId } from './id';
import type { AppError, ErrorCode } from '@/lib/contracts/errors';

const USER_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Die Eingabe konnte nicht verarbeitet werden. Bitte prüfe sie und versuche es erneut.',
  NOT_FOUND: 'Der angeforderte Eintrag existiert nicht (mehr).',
  UNAUTHORIZED: 'Für diese Aktion fehlt die Berechtigung.',
  RATE_LIMITED: 'Zu viele Anfragen. Bitte warte einen Moment.',
  LLM_UNAVAILABLE: 'Das Sprachmodell ist gerade nicht erreichbar. Bitte versuche es erneut.',
  LLM_NOT_CONFIGURED: 'Es ist kein Sprachmodell konfiguriert. Hinterlege einen Schlüssel und starte die App neu.',
  LLM_TIMEOUT: 'Das Sprachmodell hat zu lange gebraucht. Bitte versuche es erneut.',
  LLM_BAD_OUTPUT: 'Die Antwort des Sprachmodells war unbrauchbar. Bitte versuche es erneut.',
  TOOL_TIMEOUT: 'Ein Werkzeug hat zu lange gebraucht und wurde abgebrochen.',
  TOOL_FAILED: 'Ein Werkzeug ist fehlgeschlagen. Ich habe ohne dieses Ergebnis weitergearbeitet.',
  SEARCH_FAILED: 'Die Websuche ist fehlgeschlagen. Ich habe mit den vorhandenen Quellen weitergearbeitet.',
  SEARCH_NOT_CONFIGURED: 'Für die Websuche ist kein Anbieter hinterlegt (BRAVE_API_KEY oder TAVILY_API_KEY).',
  FETCH_BLOCKED: 'Diese Quelle konnte aus Sicherheitsgründen nicht geöffnet werden.',
  FETCH_FAILED: 'Diese Quelle war nicht erreichbar.',
  CONTENT_TOO_LARGE: 'Der Inhalt ist zu groß, um ihn vollständig zu verarbeiten.',
  BUDGET_EXCEEDED: 'Das Budget für diese Recherche ist erreicht. Hier ist das Zwischenergebnis.',
  RUN_CANCELLED: 'Die Recherche wurde abgebrochen.',
  DB_ERROR: 'Beim Speichern ist ein Fehler aufgetreten.',
  DB_CORRUPT_JSON: 'Gespeicherte Daten konnten nicht gelesen werden.',
  INTERNAL: 'Da ist etwas schiefgelaufen.',
};

const RETRYABLE: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'RATE_LIMITED', 'LLM_UNAVAILABLE', 'LLM_TIMEOUT', 'TOOL_TIMEOUT', 'FETCH_FAILED', 'SEARCH_FAILED',
]);

export class AppErrorException extends Error {
  readonly appError: AppError;
  constructor(appError: AppError) {
    super(appError.message);
    this.name = 'AppErrorException';
    this.appError = appError;
  }
}

export function appError(
  code: ErrorCode,
  message: string,
  options: { details?: Record<string, unknown>; userMessage?: string; retryable?: boolean } = {},
): AppError {
  const base = USER_MESSAGES[code];
  const correlationId = code === 'INTERNAL' ? newId('evt') : undefined;
  return {
    code,
    message,
    userMessage: options.userMessage ?? (correlationId ? `${base} Kennung: ${correlationId}` : base),
    retryable: options.retryable ?? RETRYABLE.has(code),
    ...(options.details ? { details: options.details } : {}),
    ...(correlationId ? { correlationId } : {}),
  };
}

export function fail(code: ErrorCode, message: string, details?: Record<string, unknown>): never {
  throw new AppErrorException(appError(code, message, details ? { details } : {}));
}

const SECRET_PATTERN = /(sk-[A-Za-z0-9_-]{6,}|Bearer\s+[A-Za-z0-9._-]{8,})/g;

export function redact(text: string): string {
  return text.replace(SECRET_PATTERN, '[redacted]');
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppErrorException) return err.appError;
  if (err && typeof err === 'object' && 'code' in err && 'userMessage' in err) {
    return err as AppError;
  }
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.message === 'aborted') {
      return appError('RUN_CANCELLED', 'aborted');
    }
    return appError('INTERNAL', redact(err.message));
  }
  return appError('INTERNAL', redact(typeof err === 'string' ? err : JSON.stringify(err)));
}

export function isAbort(err: unknown): boolean {
  return toAppError(err).code === 'RUN_CANCELLED';
}

export interface RetryPolicy {
  maxAttempts: number;
  baseMs: number;
  signal?: AbortSignal;
  onRetry?: (attempt: number, error: AppError) => void;
}

export async function withRetry<T>(fn: () => Promise<T>, policy: RetryPolicy): Promise<T> {
  let lastError: AppError | undefined;
  for (let attempt = 0; attempt <= policy.maxAttempts; attempt++) {
    if (policy.signal?.aborted) throw new AppErrorException(appError('RUN_CANCELLED', 'aborted'));
    try {
      return await fn();
    } catch (err) {
      const e = toAppError(err);
      lastError = e;
      if (!e.retryable || attempt === policy.maxAttempts || e.code === 'RUN_CANCELLED') break;
      policy.onRetry?.(attempt + 1, e);
      const jitter = 0.8 + Math.random() * 0.4;
      const delay = Math.round(policy.baseMs * Math.pow(4, attempt) * jitter);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new AppErrorException(lastError ?? appError('INTERNAL', 'unknown failure'));
}
