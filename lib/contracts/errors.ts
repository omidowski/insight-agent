/** Fehlercodes und Envelope — einzige Heimat (Spec 05, FR-05-01). */
import { z } from 'zod';

export const errorCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'RATE_LIMITED',
  'LLM_UNAVAILABLE',
  'LLM_NOT_CONFIGURED',
  'LLM_TIMEOUT',
  'LLM_BAD_OUTPUT',
  'TOOL_TIMEOUT',
  'TOOL_FAILED',
  'SEARCH_FAILED',
  'SEARCH_NOT_CONFIGURED',
  'FETCH_BLOCKED',
  'FETCH_FAILED',
  'CONTENT_TOO_LARGE',
  'BUDGET_EXCEEDED',
  'RUN_CANCELLED',
  'DB_ERROR',
  'DB_CORRUPT_JSON',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export interface AppError {
  code: ErrorCode;
  message: string;
  userMessage: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  correlationId?: string;
}

export const appErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  userMessage: z.string(),
  retryable: z.boolean(),
  details: z.record(z.unknown()).optional(),
  correlationId: z.string().optional(),
});
