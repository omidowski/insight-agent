/** Run-State, Statusübergänge, Budgets, Abbruch (Spec 17, Spec 37). */
import type { Repositories } from '@/lib/db/repositories';
import type { BudgetUsage, RunBudgets, RunStatus } from '@/lib/contracts/domain';
import type { EventEmitterLike } from './events';
import { appError, AppErrorException } from '@/lib/util/errors';
import { logger } from '@/lib/util/logger';

const TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  idle: ['routing', 'cancelled', 'failed'],
  routing: ['planning', 'synthesizing', 'searching', 'cancelled', 'failed', 'completed'],
  planning: ['searching', 'synthesizing', 'cancelled', 'failed'],
  searching: ['reading_sources', 'extracting', 'comparing', 'searching', 'synthesizing', 'cancelled', 'failed'],
  reading_sources: ['extracting', 'searching', 'comparing', 'synthesizing', 'cancelled', 'failed'],
  extracting: ['comparing', 'searching', 'reading_sources', 'synthesizing', 'cancelled', 'failed'],
  comparing: ['searching', 'synthesizing', 'planning', 'cancelled', 'failed'],
  synthesizing: ['completed', 'cancelled', 'failed'],
  completed: [],
  failed: [],
  cancelled: [],
  paused: ['searching', 'synthesizing', 'cancelled', 'failed'],
};

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export type BudgetKind = 'time' | 'cost' | 'tokens' | 'iterations' | 'searches' | 'sources';

export class RunStateManager {
  private status: RunStatus = 'idle';
  private readonly warned = new Set<BudgetKind>();
  readonly usage: BudgetUsage;
  readonly controller = new AbortController();

  constructor(
    readonly runId: string,
    readonly conversationId: string,
    readonly budgets: RunBudgets,
    readonly repos: Repositories,
    private readonly emitter: EventEmitterLike,
    usage?: BudgetUsage,
  ) {
    this.usage = usage ?? {
      iterations: 0, searches: 0, sources: 0, toolCalls: 0,
      inputTokens: 0, outputTokens: 0, costMicroUsd: 0,
      startedAt: new Date().toISOString(),
    };
  }

  private cancelWatcher: ReturnType<typeof setInterval> | undefined;

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  /**
   * Abbruchwunsch wird zusätzlich persistent geprüft (ADR-011): Next.js kann Route-Handler in
   * getrennten Modulinstanzen ausführen, sodass die In-Process-Registry allein nicht genügt.
   */
  checkCancellation(): boolean {
    if (this.controller.signal.aborted) return true;
    try {
      if (this.repos.runs.isCancelRequested(this.runId)) {
        this.cancel();
        return true;
      }
    } catch {
      /* DB-Fehler dürfen den Run nicht beenden */
    }
    return false;
  }

  /** Startet die Hintergrundprüfung des Abbruchwunsches (z. B. während des Streamings). */
  startCancelWatch(intervalMs = 250): void {
    if (this.cancelWatcher) return;
    this.cancelWatcher = setInterval(() => {
      if (this.checkCancellation()) this.stopCancelWatch();
    }, intervalMs);
    this.cancelWatcher.unref?.();
  }

  stopCancelWatch(): void {
    if (this.cancelWatcher) {
      clearInterval(this.cancelWatcher);
      this.cancelWatcher = undefined;
    }
  }

  get currentStatus(): RunStatus {
    return this.status;
  }

  get elapsedMs(): number {
    return Date.now() - new Date(this.usage.startedAt).getTime();
  }

  setStatus(to: RunStatus): void {
    if (this.status === to) return;
    if (!canTransition(this.status, to)) {
      throw new AppErrorException(
        appError('INTERNAL', `unzulässiger Statuswechsel ${this.status} → ${to}`),
      );
    }
    const from = this.status;
    this.status = to;
    this.repos.runs.update(this.runId, { status: to });
    this.emitter.emit('status.changed', { from, to });
  }

  /** Erzwingt einen Endstatus auch aus inkonsistentem Zustand (nur für finally-Pfade). */
  forceStatus(to: RunStatus): void {
    const from = this.status;
    this.status = to;
    this.repos.runs.update(this.runId, { status: to });
    if (from !== to) this.emitter.emit('status.changed', { from, to });
  }

  cancel(): void {
    if (!this.controller.signal.aborted) this.controller.abort();
  }

  addUsage(patch: Partial<Pick<BudgetUsage, 'inputTokens' | 'outputTokens' | 'costMicroUsd'>>): void {
    this.usage.inputTokens += patch.inputTokens ?? 0;
    this.usage.outputTokens += patch.outputTokens ?? 0;
    this.usage.costMicroUsd += patch.costMicroUsd ?? 0;
    this.persistUsage();
    this.checkWarning('cost', this.usage.costMicroUsd, this.budgets.maxCostMicroUsd);
    this.checkWarning('tokens', this.usage.inputTokens, this.budgets.maxInputTokens);
  }

  consume(kind: 'search' | 'source' | 'toolCall'): void {
    if (kind === 'search') {
      if (this.usage.searches >= this.budgets.maxSearches) {
        throw new AppErrorException(appError('BUDGET_EXCEEDED', 'Suchbudget erschöpft'));
      }
      this.usage.searches++;
      this.checkWarning('searches', this.usage.searches, this.budgets.maxSearches);
    } else if (kind === 'source') {
      if (this.usage.sources >= this.budgets.maxSources) {
        throw new AppErrorException(appError('BUDGET_EXCEEDED', 'Quellenbudget erschöpft'));
      }
      this.usage.sources++;
      this.checkWarning('sources', this.usage.sources, this.budgets.maxSources);
    } else {
      if (this.usage.toolCalls >= this.budgets.maxToolCalls) {
        throw new AppErrorException(appError('BUDGET_EXCEEDED', 'Werkzeugbudget erschöpft'));
      }
      this.usage.toolCalls++;
    }
    this.persistUsage();
  }

  nextIteration(): void {
    this.usage.iterations++;
    this.checkWarning('iterations', this.usage.iterations, this.budgets.maxIterations);
    this.persistUsage();
  }

  /** true, wenn weitergearbeitet werden darf. Reserviert 20 % Zeit-/Kostenbudget für die Synthese. */
  hasBudgetForResearch(): boolean {
    if (this.checkCancellation()) return false;
    if (this.elapsedMs > this.budgets.maxWallClockMs * 0.8) {
      this.checkWarning('time', this.elapsedMs, this.budgets.maxWallClockMs);
      return false;
    }
    if (this.usage.costMicroUsd > this.budgets.maxCostMicroUsd * 0.8) return false;
    if (this.usage.searches >= this.budgets.maxSearches) return false;
    if (this.usage.sources >= this.budgets.maxSources) return false;
    if (this.usage.toolCalls >= this.budgets.maxToolCalls) return false;
    return true;
  }

  private checkWarning(kind: BudgetKind, used: number, limit: number): void {
    if (limit <= 0 || this.warned.has(kind)) return;
    if (used >= limit * 0.8) {
      this.warned.add(kind);
      this.emitter.emit('budget.warning', { kind, used: Math.round(used), limit });
    }
  }

  private persistUsage(): void {
    try {
      this.repos.runs.update(this.runId, { usage: this.usage });
    } catch (err) {
      logger.warn('usage persist failed', { module: 'state', runId: this.runId, error: String(err) });
    }
  }
}

/** Registry laufender Runs für den Abbruch aus dem API-Handler (Spec 17, FR-17-04). */
const registry = new Map<string, RunStateManager>();

export function registerRun(state: RunStateManager): void {
  registry.set(state.runId, state);
}

export function unregisterRun(runId: string): void {
  registry.delete(runId);
}

export function cancelRun(runId: string): boolean {
  const state = registry.get(runId);
  if (!state) return false;
  state.cancel();
  return true;
}

export function markCancelled(runId: string, repos: { runs: { requestCancel: (id: string) => void } }): void {
  repos.runs.requestCancel(runId);
  cancelRun(runId);
}

export function isRunActive(runId: string): boolean {
  return registry.has(runId);
}
