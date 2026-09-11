import { describe, expect, it } from 'vitest';
import { createRunRequestSchema, researchOptionsSchema } from '@/lib/contracts/schemas';
import { plannerPrompt, queryGenPrompt, synthesisPrompt } from '@/lib/agent/prompts';
import type { ResearchOptions } from '@/lib/contracts/domain';

describe('Research Options & Specifications', () => {
  it('parses valid research options schema', () => {
    const valid: ResearchOptions = {
      depth: 'deep',
      timeframe: 'month',
      focusDomains: ['reuters.com', 'bloomberg.com'],
      excludeDomains: ['reddit.com', 'pinterest.com'],
      aspects: 'Finanzzahlen und Marktwachstum 2024',
      outputFormat: 'detailed_report',
    };

    const parsed = researchOptionsSchema.parse(valid);
    expect(parsed.depth).toBe('deep');
    expect(parsed.timeframe).toBe('month');
    expect(parsed.focusDomains).toEqual(['reuters.com', 'bloomberg.com']);
    expect(parsed.excludeDomains).toEqual(['reddit.com', 'pinterest.com']);
    expect(parsed.aspects).toContain('Finanzzahlen');
    expect(parsed.outputFormat).toBe('detailed_report');
  });

  it('validates createRunRequestSchema with researchOptions', () => {
    const req = createRunRequestSchema.parse({
      message: 'Recherchiere Quantencomputer-Startups',
      mode: 'research',
      researchOptions: {
        depth: 'quick',
        timeframe: 'year',
        outputFormat: 'comparison_table',
        focusDomains: ['arxiv.org'],
      },
    });

    expect(req.message).toBe('Recherchiere Quantencomputer-Startups');
    expect(req.mode).toBe('research');
    expect(req.researchOptions?.depth).toBe('quick');
    expect(req.researchOptions?.timeframe).toBe('year');
    expect(req.researchOptions?.outputFormat).toBe('comparison_table');
    expect(req.researchOptions?.focusDomains).toEqual(['arxiv.org']);
  });

  it('plannerPrompt incorporates aspects and timeframe requirements', () => {
    const prompt = plannerPrompt(
      'Elektrofahrzeuge vs Wasserstoff',
      'comparison',
      [],
      {
        aspects: 'Wirkungsgrad, Ladeinfrastruktur und Gesamtkosten',
        timeframe: 'year',
      },
    );

    expect(prompt.system).toContain('Fokus-Aspekte');
    expect(prompt.system).toContain('Zeithorizont');
    const aspectsBlock = prompt.input.find(
      (i): i is { role: 'data'; label: string; content: string } => i.role === 'data' && i.label === 'FOKUS_ASPEKTE',
    );
    expect(aspectsBlock?.content).toBe('Wirkungsgrad, Ladeinfrastruktur und Gesamtkosten');
    const timeframeBlock = prompt.input.find(
      (i): i is { role: 'data'; label: string; content: string } => i.role === 'data' && i.label === 'ZEITRAUM',
    );
    expect(timeframeBlock?.content).toContain('letztes Jahr');
  });

  it('queryGenPrompt incorporates preferred focus domains and timeframe', () => {
    const prompt = queryGenPrompt(
      'Umsatzentwicklung europäischer Tech-Konzerne',
      [],
      {
        focusDomains: ['reuters.com', 'handelsblatt.com'],
        timeframe: 'month',
      },
    );

    expect(prompt.system).toContain('reuters.com');
    const domainsBlock = prompt.input.find(
      (i): i is { role: 'data'; label: string; content: string } => i.role === 'data' && i.label === 'BEVORZUGTE_QUELLEN',
    );
    expect(domainsBlock?.content).toBe('reuters.com, handelsblatt.com');
  });

  it('synthesisPrompt adapts format rules for detailed_report and comparison_table', () => {
    const reportPrompt = synthesisPrompt({
      request: 'Marktstudie Halbleiter',
      plan: ['1. Schritt: Angebot', '2. Schritt: Nachfrage'],
      sources: [{ index: 1, domain: 'reuters.com', fetchedAt: '2026-01-01', content: 'Umsatz stieg um 15%' }],
      conflicts: '',
      gaps: '',
      options: { outputFormat: 'detailed_report', aspects: 'Geopolitische Risiken' },
    });

    expect(reportPrompt.system).toContain('ausführlichen Recherchebericht');
    expect(reportPrompt.system).toContain('Executive Summary');
    const aspectsBlock = reportPrompt.input.find(
      (i): i is { role: 'data'; label: string; content: string } => i.role === 'data' && i.label === 'GEWÜNSCHTE_SCHWERPUNKTE',
    );
    expect(aspectsBlock?.content).toBe('Geopolitische Risiken');

    const tablePrompt = synthesisPrompt({
      request: 'Vergleich Cloud-Anbieter',
      plan: [],
      sources: [],
      conflicts: '',
      gaps: '',
      options: { outputFormat: 'comparison_table' },
    });

    expect(tablePrompt.system).toContain('Markdown-Tabelle');
  });
});
