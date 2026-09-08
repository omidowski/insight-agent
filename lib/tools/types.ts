/** Tool-Definition und Ausführungskontext (Spec 18, FR-18-01). */
import type { z } from 'zod';
import type { ToolName } from '@/lib/contracts/domain';
import type { Repositories } from '@/lib/db/repositories';
import type { AppConfig } from '@/lib/config/env';
import type { EventEmitterLike } from '@/lib/agent/events';
import type { SearchProvider } from '@/lib/search/provider';
import type { Logger } from '@/lib/util/logger';

export interface ToolContext {
  runId: string;
  conversationId: string;
  stepId: string | null;
  signal: AbortSignal;
  emitter: EventEmitterLike;
  repos: Repositories;
  config: AppConfig;
  logger: Logger;
  /** Injizierter Suchanbieter — ermöglicht Austausch ohne globalen Zustand. */
  search: SearchProvider;
  /** Run-lokaler Cache für identische Tool-Aufrufe (Spec 18, Edge 2). */
  cache: Map<string, unknown>;
  /** Zählt Budgetverbrauch; wirft BUDGET_EXCEEDED. */
  consume: (kind: 'search' | 'source' | 'toolCall') => void;
}

export interface ToolDefinition<P = unknown, R = unknown> {
  name: ToolName;
  description: string;
  parameters: z.ZodType<P>;
  result: z.ZodType<R>;
  timeoutMs: number;
  maxRetries: number;
  costClass: 'free' | 'cheap' | 'expensive';
  resultTokenBudget: number;
  cacheable: boolean;
  execute(args: P, ctx: ToolContext): Promise<R>;
  summarize(result: R): string;
}

export interface ToolOk<R> { ok: true; result: R }
export interface ToolErr { ok: false; code: string; message: string }
export type ToolOutcome<R> = ToolOk<R> | ToolErr;
