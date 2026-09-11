/**
 * Evaluation Harness Starter (Spec 41).
 * Reproducible benchmark measuring research quality, citation coverage,
 * verified excerpts, source diversity, runtime, and costs.
 */
import type { Mode } from '@/lib/client/types';

export interface GoldenEvalCase {
  id: string;
  title: string;
  prompt: string;
  mode: Mode;
  expectedTaskType?: string;
  minSources: number;
  minCitations: number;
  expectedKeywords: string[];
}

export interface EvalCaseResult {
  id: string;
  title: string;
  passed: boolean;
  taskType: string;
  durationMs: number;
  costMicroUsd: number;
  sourceCount: number;
  uniqueDomains: number;
  citationCount: number;
  excerptCount: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  error?: string;
}

export interface EvalReport {
  timestamp: string;
  totalCases: number;
  passedCases: number;
  passRate: number;
  meanDurationMs: number;
  totalCostMicroUsd: number;
  totalCitations: number;
  totalSources: number;
  results: EvalCaseResult[];
}

export const GOLDEN_SET: GoldenEvalCase[] = [
  {
    id: 'eval-01-musiala',
    title: 'Sportstatistik Jamal Musiala',
    prompt: 'Recherchiere aktuelle Statistiken über den Fußballspieler Jamal Musiala.',
    mode: 'auto',
    expectedTaskType: 'deep_research',
    minSources: 2,
    minCitations: 1,
    expectedKeywords: ['musiala', 'bundesliga', 'saison'],
  },
  {
    id: 'eval-02-revenue',
    title: 'Umsatzvergleich europäischer Fußballvereine',
    prompt: 'Vergleiche den Umsatz der wertvollsten europäischen Fußballvereine und erstelle eine Tabelle.',
    mode: 'auto',
    expectedTaskType: 'comparison',
    minSources: 1,
    minCitations: 1,
    expectedKeywords: ['umsatz', 'madrid'],
  },
  {
    id: 'eval-03-embedding',
    title: 'Erklärung Vektor-Embedding (Konversation/Chat)',
    prompt: 'Was ist ein Vektor-Embedding?',
    mode: 'chat',
    expectedTaskType: 'conversation',
    minSources: 0,
    minCitations: 0,
    expectedKeywords: ['vektor', 'embedding'],
  },
  {
    id: 'eval-04-weather',
    title: 'Wetter Live-Lookup',
    prompt: 'Wie ist das Wetter in München heute?',
    mode: 'auto',
    expectedTaskType: 'web_lookup',
    minSources: 0,
    minCitations: 0,
    expectedKeywords: ['wetter'],
  },
];

export function computeReport(results: EvalCaseResult[]): EvalReport {
  const totalCases = results.length;
  const passedCases = results.filter((r) => r.passed).length;
  const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0);
  const totalCost = results.reduce((acc, r) => acc + r.costMicroUsd, 0);
  const totalCitations = results.reduce((acc, r) => acc + r.citationCount, 0);
  const totalSources = results.reduce((acc, r) => acc + r.sourceCount, 0);

  return {
    timestamp: new Date().toISOString(),
    totalCases,
    passedCases,
    passRate: totalCases > 0 ? passedCases / totalCases : 0,
    meanDurationMs: totalCases > 0 ? Math.round(totalDuration / totalCases) : 0,
    totalCostMicroUsd: totalCost,
    totalCitations,
    totalSources,
    results,
  };
}

export function formatReportMarkdown(report: EvalReport): string {
  const lines: string[] = [
    '# Insight Agent Evaluation Report (Spec 41)',
    '',
    `- **Datum:** ${report.timestamp}`,
    `- **Ergebnis:** ${report.passedCases}/${report.totalCases} bestanden (${(report.passRate * 100).toFixed(1)}%)`,
    `- **Durchschnittliche Laufzeit:** ${report.meanDurationMs} ms`,
    `- **Quellen insgesamt:** ${report.totalSources}`,
    `- **Belege/Citations:** ${report.totalCitations}`,
    `- **Kosten:** ${(report.totalCostMicroUsd / 1_000_000).toFixed(4)} USD`,
    '',
    '| ID | Szenario | Status | Typ | Quellen | Belege | Laufzeit |',
    '|---|---|---|---|---|---|---|',
  ];

  for (const r of report.results) {
    const status = r.passed
      ? '✓ PASS'
      : `✕ FAIL ${r.error ? `(${r.error})` : r.missingKeywords.length > 0 ? `(fehlt: ${r.missingKeywords.join(', ')})` : ''}`;
    lines.push(
      `| ${r.id} | ${r.title} | ${status} | ${r.taskType} | ${r.sourceCount} | ${r.citationCount} | ${r.durationMs}ms |`,
    );
  }

  return lines.join('\n');
}
