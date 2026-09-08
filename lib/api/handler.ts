/** Gemeinsame Hülle für alle Route Handler (Spec 08). */
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { getConfig } from '@/lib/config/env';
import { getRepositories, LOCAL_USER_ID, type Repositories } from '@/lib/db/repositories';
import { appError, AppErrorException, toAppError } from '@/lib/util/errors';
import type { AppError, ErrorCode } from '@/lib/contracts/errors';
import { checkRateLimit } from '@/lib/util/rate-limit';
import { logger } from '@/lib/util/logger';

const STATUS_BY_CODE: Partial<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
};

export interface ApiContext {
  repos: Repositories;
  userId: string;
  config: ReturnType<typeof getConfig>;
  origin: string;
}

export function errorResponse(error: AppError, status?: number): NextResponse {
  return NextResponse.json(
    { error: { code: error.code, message: error.message, userMessage: error.userMessage, retryable: error.retryable } },
    { status: status ?? STATUS_BY_CODE[error.code] ?? 500 },
  );
}

export function apiContext(request: Request): ApiContext {
  const repos = getRepositories();
  repos.users.ensureLocal();
  return {
    repos,
    userId: LOCAL_USER_ID,
    config: getConfig(),
    origin: new URL(request.url).origin,
  };
}

export async function withApi(
  request: Request,
  handler: (ctx: ApiContext) => Promise<NextResponse>,
  options: { rateLimitKey?: string; limit?: number } = {},
): Promise<NextResponse> {
  const started = Date.now();
  let status = 200;
  try {
    const ctx = apiContext(request);
    if (options.rateLimitKey && ctx.config.RATE_LIMIT_ENABLED) {
      const result = checkRateLimit(
        `${ctx.userId}:${options.rateLimitKey}`,
        options.limit ?? ctx.config.RATE_LIMIT_RUNS_PER_HOUR,
        3_600_000,
      );
      if (!result.allowed) {
        const error = appError('RATE_LIMITED', 'rate limit exceeded');
        status = 429;
        const response = errorResponse(error, 429);
        response.headers.set('Retry-After', String(Math.max(1, result.resetInSeconds)));
        return response;
      }
    }
    const response = await handler(ctx);
    status = response.status;
    return response;
  } catch (err) {
    const error = err instanceof AppErrorException ? err.appError : toAppError(err);
    status = STATUS_BY_CODE[error.code] ?? 500;
    if (status >= 500) {
      logger.error('api error', { module: 'api', code: error.code, message: error.message });
    }
    return errorResponse(error, status);
  } finally {
    logger.info('request', {
      module: 'api',
      method: request.method,
      path: new URL(request.url).pathname,
      status,
      ms: Date.now() - started,
    });
  }
}

export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new AppErrorException(appError('VALIDATION_FAILED', 'Body ist kein gültiges JSON'));
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    throw new AppErrorException(appError('VALIDATION_FAILED', detail, { userMessage: detail }));
  }
  return parsed.data;
}

export function notFound(what = 'Eintrag'): AppErrorException {
  return new AppErrorException(appError('NOT_FOUND', `${what} nicht gefunden`));
}

export function conflict(message: string): AppErrorException {
  return new AppErrorException(
    appError('VALIDATION_FAILED', message, { userMessage: message }),
  );
}
