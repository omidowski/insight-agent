/** Planerzeugung und Replanning (Spec 15). */
import type { LLMProvider } from '@/lib/llm/provider';
import type { AppConfig } from '@/lib/config/env';
import type { PlanStep, ResearchOptions, TaskType } from '@/lib/contracts/domain';
import { planOutputSchema } from '@/lib/contracts/schemas';
import { plannerPrompt } from './prompts';
import { newId } from '@/lib/util/id';
import { topoSort } from '@/lib/util/graph';
import { logger } from '@/lib/util/logger';
import { isAbort } from '@/lib/util/errors';

function fallbackPlan(request: string): PlanStep[] {
  return [
    {
      id: newId('stp'), seq: 1, title: 'Recherche',
      question: request.slice(0, 300), dependsOn: [], status: 'pending',
    },
  ];
}

export async function createPlan(args: {
  request: string;
  taskType: TaskType;
  context: string[];
  llm: LLMProvider;
  config: AppConfig;
  signal?: AbortSignal;
  runId?: string;
  options?: ResearchOptions;
}): Promise<PlanStep[]> {
  const prompt = plannerPrompt(args.request, args.taskType, args.context, args.options);
  let steps: PlanStep[];
  try {
    const output = await args.llm.generateObject({
      system: prompt.system,
      input: prompt.input,
      model: 'fast',
      schema: planOutputSchema,
      schemaName: 'research_plan',
      purpose: 'plan',
      ...(args.signal ? { signal: args.signal } : {}),
      ...(args.runId ? { runId: args.runId } : {}),
    });

    const raw = output.steps
      .filter((s) => s.question.trim().length > 5)
      .slice(0, args.config.MAX_PLAN_STEPS);
    if (raw.length === 0) return fallbackPlan(args.request);

    const ids = raw.map(() => newId('stp'));
    steps = raw.map((step, index) => ({
      id: ids[index] as string,
      seq: index + 1,
      title: step.title.trim().slice(0, 120) || `Schritt ${index + 1}`,
      question: step.question.trim().slice(0, 300),
      dependsOn: step.dependsOn
        .filter((d) => Number.isInteger(d) && d >= 0 && d < raw.length && d !== index)
        .map((d) => ids[d] as string),
      status: 'pending' as const,
    }));
  } catch (err) {
    if (isAbort(err)) throw err;
    logger.warn('planner fallback', { module: 'planner', error: String(err).slice(0, 200) });
    return fallbackPlan(args.request);
  }

  const { ordered, removedEdges } = topoSort(steps);
  if (removedEdges.length > 0) {
    logger.warn('plan cycle resolved', { module: 'planner', removed: removedEdges.length });
    const allowed = new Set(ordered.map((s) => s.id));
    for (const edge of removedEdges) {
      const node = steps.find((s) => s.id === edge.from);
      if (node) node.dependsOn = node.dependsOn.filter((d) => d !== edge.to && allowed.has(d));
    }
  }
  return ordered.map((step, index) => ({ ...step, seq: index + 1 }));
}

/** Erzeugt Folgeschritte für erkannte Lücken (Spec 25, FR-25-02). */
export function gapSteps(gaps: string[], startSeq: number): PlanStep[] {
  return gaps.slice(0, 3).map((gap, index) => ({
    id: newId('stp'),
    seq: startSeq + index,
    title: 'Nachrecherche',
    question: gap.slice(0, 300),
    dependsOn: [],
    status: 'pending' as const,
  }));
}
