import { describe, expect, it } from 'vitest';
import {
  GOLDEN_SET,
  computeReport,
  formatReportMarkdown,
  type EvalCaseResult,
} from '@/lib/eval/harness';
import { runEvaluation } from '@/lib/eval/runner';

describe('Spec 41 — Evaluation Harness', () => {
  it('FR-41-01: Golden-Set enthält definierte Testszenarien mit Erwartungswerten', () => {
    expect(GOLDEN_SET.length).toBeGreaterThanOrEqual(3);
    for (const item of GOLDEN_SET) {
      expect(item.id).toMatch(/^eval-/);
      expect(item.prompt.length).toBeGreaterThan(5);
      expect(['auto', 'chat', 'research']).toContain(item.mode);
      expect(Array.isArray(item.expectedKeywords)).toBe(true);
    }
  });

  it('FR-41-02: computeReport aggregiert Kennzahlen korrekt', () => {
    const mockResults: EvalCaseResult[] = [
      {
        id: 't1',
        title: 'T1',
        passed: true,
        taskType: 'deep_research',
        durationMs: 200,
        costMicroUsd: 100,
        sourceCount: 3,
        uniqueDomains: 2,
        citationCount: 2,
        excerptCount: 3,
        matchedKeywords: ['k1'],
        missingKeywords: [],
      },
      {
        id: 't2',
        title: 'T2',
        passed: false,
        taskType: 'conversation',
        durationMs: 100,
        costMicroUsd: 50,
        sourceCount: 0,
        uniqueDomains: 0,
        citationCount: 0,
        excerptCount: 0,
        matchedKeywords: [],
        missingKeywords: ['k2'],
      },
    ];

    const report = computeReport(mockResults);
    expect(report.totalCases).toBe(2);
    expect(report.passedCases).toBe(1);
    expect(report.passRate).toBe(0.5);
    expect(report.meanDurationMs).toBe(150);
    expect(report.totalCostMicroUsd).toBe(150);
    expect(report.totalCitations).toBe(2);
    expect(report.totalSources).toBe(3);

    const md = formatReportMarkdown(report);
    expect(md).toContain('# Insight Agent Evaluation Report');
    expect(md).toContain('1/2 bestanden (50.0%)');
    expect(md).toContain('✓ PASS');
    expect(md).toContain('✕ FAIL');
  });

  it('FR-41-05: runEvaluation führt Chat-Szenario deterministisch aus', async () => {
    const chatCase = GOLDEN_SET.find((c) => c.mode === 'chat')!;
    const report = await runEvaluation([chatCase]);
    expect(report.totalCases).toBe(1);
    expect(report.passedCases).toBe(1);
    expect(report.results[0]!.passed).toBe(true);
    expect(report.results[0]!.durationMs).toBeGreaterThan(0);
  });
});
