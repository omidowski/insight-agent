import { describe, expect, it } from 'vitest';
import { evaluateGaps } from '@/lib/agent/research/gaps';
import type { PlanStep, StepResult } from '@/lib/contracts/domain';

function step(id: string, question: string, status: PlanStep['status'] = 'pending'): PlanStep {
  return {
    id,
    seq: 1,
    title: question,
    question,
    dependsOn: [],
    status,
  };
}

function result(stepId: string, sourceIds: string[], confidence: number, items = 1): StepResult {
  return {
    stepId,
    answer: items > 0 ? 'ok' : '',
    sourceIds,
    items: Array.from({ length: items }, (_, i) => ({
      claimKey: `k.${i}`,
      label: 'l',
      value: 'v',
      excerpt: 'e',
      confidence,
      sourceId: sourceIds[0] ?? 'src',
    })),
    confidence,
  };
}

describe('IAAR-0201 — research gap evaluation harden', () => {
  it('flags missing results and weak evidence as gaps', () => {
    const plan = [step('s1', 'Q1'), step('s2', 'Q2'), step('s3', 'Q3')];
    const results = new Map<string, StepResult>([
      ['s1', result('s1', ['a', 'b'], 0.9)],
      ['s2', result('s2', ['a'], 0.9)], // too few sources
      ['s3', result('s3', ['a', 'b'], 0.2)], // low confidence
    ]);
    const gaps = evaluateGaps(plan, results, 2, 0.5);
    expect(gaps).toEqual(['Q2', 'Q3']);
  });

  it('dedupes gap questions case-insensitively', () => {
    const plan = [step('s1', 'Wetter Hamburg?'), step('s2', 'wetter hamburg?')];
    const gaps = evaluateGaps(plan, new Map(), 2, 0.5);
    expect(gaps).toEqual(['Wetter Hamburg?']);
  });

  it('treats empty items as a gap even if a result row exists', () => {
    const plan = [step('s1', 'Q')];
    const results = new Map([['s1', result('s1', [], 0, 0)]]);
    expect(evaluateGaps(plan, results, 2, 0.5)).toEqual(['Q']);
  });
});
