/** Gap analysis for deep research loop (Spec 25 FR-25-01). */
import type { PlanStep, StepResult } from '@/lib/contracts/domain';

export function evaluateGaps(
  plan: PlanStep[],
  results: Map<string, StepResult>,
  minSources: number,
  minConfidence: number,
): string[] {
  const gaps: string[] = [];
  const seen = new Set<string>();
  const add = (question: string) => {
    const key = question.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    gaps.push(question);
  };
  for (const step of plan) {
    const result = results.get(step.id);
    if (!result || result.items.length === 0) {
      add(step.question);
      continue;
    }
    const distinct = new Set(result.sourceIds).size;
    if (distinct < minSources || result.confidence < minConfidence) add(step.question);
  }
  return gaps;
}
