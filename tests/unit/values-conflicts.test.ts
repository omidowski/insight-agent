import { describe, expect, it } from 'vitest';
import { compareValues, normalizeValue, periodOf } from '@/lib/util/values';
import { detectConflicts } from '@/lib/agent/research/conflicts';
import type { ExtractionItem, SourceRecord } from '@/lib/contracts/domain';

function source(id: string, index: number, trust = 0.7): SourceRecord {
  return {
    id, runId: 'run_1', conversationId: 'cnv_1', indexNum: index,
    url: `https://q${index}.example/`, canonicalUrl: `https://q${index}.example`,
    domain: `q${index}.example`, title: `Quelle ${index}`, author: null,
    publishedAt: null, fetchedAt: null, sourceType: 'secondary', trustScore: trust,
    contentHash: null, rawTextLen: 100, status: 'fetched', note: null, createdAt: '',
  };
}

function item(claimKey: string, value: string, sourceId: string, excerpt = ''): ExtractionItem {
  return { claimKey, label: claimKey, value, excerpt, sourceId, confidence: 0.8 };
}

describe('Spec 28 — Widerspruchserkennung', () => {
  it('AC-28-01: „1,2 Mio." und „1200000" gelten als gleich', () => {
    expect(compareValues('1,2 Mio.', '1200000').equal).toBe(true);
    expect(normalizeValue('1,2 Mio. €').number).toBe(1_200_000);
    expect(normalizeValue('1,2 Mio. €').currency).toBe('EUR');
  });

  it('unterschiedliche Währungen sind ein Konflikt', () => {
    expect(compareValues('765 Mio. €', '765 Mio. USD')).toMatchObject({ equal: false, reason: 'currency_mismatch' });
  });

  it('Toleranz von 1 % gilt als Übereinstimmung', () => {
    expect(compareValues('1000', '1005').equal).toBe(true);
    expect(compareValues('1000', '1100').equal).toBe(false);
  });

  it('AC-28-02: abweichende Werte erzeugen einen Konflikt mit beiden Angaben', () => {
    const sources = [source('src_1', 1), source('src_2', 2, 0.5)];
    const result = detectConflicts(
      [item('bayern.umsatz', '765 Mio. €', 'src_1'), item('bayern.umsatz', '744 Mio. €', 'src_2')],
      sources, 0.01,
    );
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]!.entries.map((e) => e.index).sort()).toEqual([1, 2]);
    expect(result.conflicts[0]!.description).toContain('765');
    expect(result.conflicts[0]!.description).toContain('744');
    expect(result.conflicts[0]!.entries[0]!.trustScore).toBeGreaterThanOrEqual(result.conflicts[0]!.entries[1]!.trustScore);
  });

  it('AC-28-04: unterschiedliche Zeiträume sind kein Konflikt', () => {
    const sources = [source('src_1', 1), source('src_2', 2)];
    const result = detectConflicts(
      [
        item('bayern.umsatz', '765 Mio. €', 'src_1', 'Saison 2024/25 lag der Umsatz bei 765 Mio. €'),
        item('bayern.umsatz', '744 Mio. €', 'src_2', 'Saison 2025/26 lag der Umsatz bei 744 Mio. €'),
      ],
      sources, 0.01,
    );
    expect(result.conflicts).toHaveLength(0);
  });

  it('übereinstimmende Werte zählen als Bestätigung', () => {
    const sources = [source('src_1', 1), source('src_2', 2)];
    const result = detectConflicts(
      [item('musiala.tore', '14', 'src_1'), item('musiala.tore', '14', 'src_2')],
      sources, 0.01,
    );
    expect(result.conflicts).toHaveLength(0);
    expect(result.agreementCount).toBe(1);
    expect(result.agreementBySource.get('src_1')).toBe(1);
  });

  it('erkennt Zeiträume', () => {
    expect(periodOf('musiala.tore.2025_26')).toBeDefined();
    expect(periodOf('Saison 2025/26')).toBe('2025/26');
  });
});
