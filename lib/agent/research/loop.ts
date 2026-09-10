/** Iterative Recherche mit Lückenanalyse und Sättigungserkennung (Spec 25, Spec 16). */
import type { PlanStep, StepResult, StopReason } from '@/lib/contracts/domain';
import type { ResearchContext } from './engine';
import { researchStep } from './engine';
import { detectConflicts, type DetectedConflict } from './conflicts';
import { evaluateGaps } from './gaps';
import { gapSteps } from '../planner';
import { topoSort } from '@/lib/util/graph';
import { mapLimit } from '@/lib/util/concurrency';
import { trustScoreFor, classifySource } from './source-scoring';
import { logger } from '@/lib/util/logger';
import { isAbort } from '@/lib/util/errors';

export interface LoopResult {
  iterations: number;
  stepResults: StepResult[];
  gaps: string[];
  conflicts: DetectedConflict[];
  stopReason: StopReason;
  plan: PlanStep[];
}

export { evaluateGaps } from './gaps';

export async function runResearchLoop(ctx: ResearchContext, initialPlan: PlanStep[]): Promise<LoopResult> {
  let plan = [...initialPlan];
  const results = new Map<string, StepResult>();
  let stopReason: StopReason = 'answered';
  let iterations = 0;

  for (;;) {
    if (ctx.state.checkCancellation()) { stopReason = 'cancelled'; break; }
    iterations++;
    ctx.state.nextIteration();

    const sourcesBefore = ctx.repos.sources.listByRun(ctx.runId).length;
    const claimsBefore = new Set(
      Array.from(results.values()).flatMap((r) => r.items.map((i) => i.claimKey)),
    ).size;

    const pending = plan.filter((s) => s.status === 'pending');
    const { ordered } = topoSort(pending);
    const done = new Set(
      plan.filter((s) => s.status === 'completed').map((s) => s.id),
    );

    // Wellen bilden: Schritte ohne offene Abhängigkeit laufen parallel (Spec 16, FR-16-02)
    let remaining = ordered;
    while (remaining.length > 0) {
      if (ctx.state.checkCancellation()) { stopReason = 'cancelled'; break; }
      const ready = remaining.filter((s) => s.dependsOn.every((d) => done.has(d)));
      const wave = ready.length > 0 ? ready : remaining.slice(0, 1);

      if (!ctx.state.hasBudgetForResearch()) {
        for (const step of remaining) {
          step.status = 'skipped';
          ctx.repos.steps.update(step.id, { status: 'skipped' });
        }
        stopReason = 'budget';
        remaining = [];
        break;
      }

      const waveResults = await mapLimit(wave, ctx.config.STEP_CONCURRENCY, async (step) => {
        step.status = 'running';
        ctx.repos.steps.update(step.id, { status: 'running' });
        try {
          const result = await researchStep(ctx, step);
          return { step, result };
        } catch (err) {
          if (isAbort(err)) throw err;
          logger.warn('step failed', { module: 'loop', runId: ctx.runId, stepId: step.id });
          return {
            step,
            result: {
              stepId: step.id, answer: '', sourceIds: [], items: [],
              confidence: 0, note: 'Schritt fehlgeschlagen',
            } as StepResult,
          };
        }
      });

      for (const { step, result } of waveResults) {
        results.set(step.id, result);
        step.status = result.items.length > 0 ? 'completed' : 'failed';
        step.result = result;
        ctx.repos.steps.update(step.id, { status: step.status, result });
        if (step.status === 'completed') done.add(step.id);
      }

      remaining = remaining.filter((s) => !wave.includes(s));
      // Schritte, deren Vorgänger endgültig fehlschlugen, überspringen (Spec 16, FR-16-04)
      const blocked = remaining.filter((s) =>
        s.dependsOn.some((d) => {
          const dep = plan.find((p) => p.id === d);
          return dep && (dep.status === 'failed' || dep.status === 'skipped');
        }),
      );
      for (const step of blocked) {
        step.status = 'skipped';
        ctx.repos.steps.update(step.id, { status: 'skipped' });
      }
      remaining = remaining.filter((s) => !blocked.includes(s));
    }

    if (stopReason === 'cancelled' || stopReason === 'budget') break;

    const gaps = evaluateGaps(plan, results, ctx.config.MIN_SOURCES_PER_CLAIM, ctx.config.MIN_STEP_CONFIDENCE);
    if (gaps.length === 0) { stopReason = 'answered'; break; }

    // Sättigung: diese Iteration brachte weder neue Quelle noch neuen claimKey (Spec 25, FR-25-04)
    const sourcesAfter = ctx.repos.sources.listByRun(ctx.runId).length;
    const claimsAfter = new Set(
      Array.from(results.values()).flatMap((r) => r.items.map((i) => i.claimKey)),
    ).size;
    if (iterations > 1 && sourcesAfter === sourcesBefore && claimsAfter === claimsBefore) {
      stopReason = 'saturation';
      break;
    }

    if (iterations >= ctx.state.budgets.maxIterations) { stopReason = 'budget'; break; }
    if (!ctx.state.hasBudgetForResearch()) { stopReason = 'budget'; break; }

    const followUps = gapSteps(gaps, plan.length + 1);
    if (followUps.length === 0) { stopReason = 'saturation'; break; }
    ctx.repos.steps.createMany(ctx.runId, followUps);
    plan = [...plan, ...followUps];
    ctx.emitter.emit('plan.updated', {
      reason: `${gaps.length} offene Punkte — Nachrecherche gestartet`,
      steps: followUps.map((s) => ({ id: s.id, title: s.title, question: s.question })),
    });
  }

  const allItems = Array.from(results.values()).flatMap((r) => r.items);
  const sources = ctx.repos.sources.listByRun(ctx.runId);
  const comparison = detectConflicts(allItems, sources, ctx.config.CONFLICT_NUMERIC_TOLERANCE);

  // Trust-Score um Übereinstimmung nachjustieren (Spec 26, FR-26-04)
  for (const source of sources) {
    if (source.status !== 'fetched') continue;
    const agreements = comparison.agreementBySource.get(source.id) ?? 0;
    const itemsOfSource = allItems.filter((i) => i.sourceId === source.id).length;
    const agreement = itemsOfSource > 0 ? Math.min(1, agreements / itemsOfSource) : 0;
    ctx.repos.sources.update(source.id, {
      trustScore: trustScoreFor({
        domain: source.domain,
        sourceType: source.sourceType || classifySource(source.domain),
        publishedAt: source.publishedAt,
        agreement,
      }),
    });
  }

  if (comparison.comparedCount > 0) {
    ctx.emitter.emit('sources.compared', {
      comparedCount: comparison.comparedCount,
      agreementCount: comparison.agreementCount,
      conflictCount: comparison.conflicts.length,
    });
  }
  for (const conflict of comparison.conflicts) {
    ctx.repos.conflicts.create(ctx.runId, conflict.claimKey, conflict.description, conflict.entries);
    ctx.emitter.emit('conflict.detected', {
      claimKey: conflict.claimKey,
      description: conflict.description.slice(0, 300),
      sourceIndexes: conflict.entries.map((e) => e.index),
    });
  }

  return {
    iterations,
    stepResults: Array.from(results.values()),
    gaps: evaluateGaps(plan, results, ctx.config.MIN_SOURCES_PER_CLAIM, ctx.config.MIN_STEP_CONFIDENCE),
    conflicts: comparison.conflicts,
    stopReason,
    plan,
  };
}
