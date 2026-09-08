import { describe, expect, it } from 'vitest';
import { applyCitations, renderSourceList, splitSentences } from '@/lib/agent/research/citations';
import type { ExcerptRecord, SourceRecord } from '@/lib/contracts/domain';

function source(index: number): SourceRecord {
  return {
    id: `src_${index}`, runId: 'run_1', conversationId: 'cnv_1', indexNum: index,
    url: `https://q${index}.example/a`, canonicalUrl: `https://q${index}.example/a`,
    domain: `q${index}.example`, title: `Quelle ${index}`, author: null,
    publishedAt: '2026-08-01T00:00:00.000Z', fetchedAt: '2026-09-01T00:00:00.000Z',
    sourceType: 'secondary', trustScore: 0.7, contentHash: null, rawTextLen: 10,
    status: 'fetched', note: null, createdAt: '',
  };
}

function excerpt(id: string, sourceId: string, text: string): ExcerptRecord {
  return {
    id, sourceId, runId: 'run_1', text, startOffset: 0, endOffset: text.length,
    claimKey: null, extractedValue: null, createdAt: '',
  };
}

const sources = [source(1), source(2), source(3)];
const excerpts = [
  excerpt('exc_1', 'src_1', 'Musiala erzielte 14 Tore in der Saison 2025/26.'),
  excerpt('exc_2', 'src_2', 'Der Marktwert beträgt 140 Mio. Euro.'),
];

describe('Spec 27 — Citation-System', () => {
  it('AC-27-01: unbekannte Marker werden entfernt, bekannte bleiben', () => {
    const result = applyCitations({
      answer: 'Musiala erzielte 14 Tore [1]. Der Marktwert liegt bei 140 Mio. [9].',
      sources, excerpts, minExcerptMatch: 0.3,
    });
    expect(result.text).toContain('[1]');
    expect(result.text).not.toContain('[9]');
    expect(result.removedMarkers).toEqual([9]);
  });

  it('AC-27-02: mehrere Marker in einem Satz erzeugen mehrere Citations', () => {
    const result = applyCitations({
      answer: 'Beide Quellen nennen 14 Tore [1][2].',
      sources, excerpts, minExcerptMatch: 0.3,
    });
    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]!.claimText).toBe(result.citations[1]!.claimText);
    expect(result.citations.map((c) => c.marker).sort()).toEqual([1, 2]);
  });

  it('ordnet passende Excerpts zu', () => {
    const result = applyCitations({
      answer: 'Musiala erzielte 14 Tore in der Saison 2025/26 [1].',
      sources, excerpts, minExcerptMatch: 0.3,
    });
    expect(result.citations[0]!.excerptId).toBe('exc_1');
  });

  it('AC-12-03: Marker in Codeblöcken bleiben unverändert und erzeugen keine Citation', () => {
    const result = applyCitations({
      answer: 'Beispiel:\n\n```\nconst a = arr[1];\n```\n\nDer Wert ist belegt [1].',
      sources, excerpts, minExcerptMatch: 0.3,
    });
    expect(result.text).toContain('const a = arr[1];');
    expect(result.citations.filter((c) => c.claimText.includes('const'))).toHaveLength(0);
  });

  it('erkennt unbelegte faktische Aussagen', () => {
    const result = applyCitations({
      answer: 'Musiala erzielte 14 Tore [1]. Er absolvierte außerdem 41 Spiele über alle Wettbewerbe hinweg.',
      sources, excerpts, minExcerptMatch: 0.3,
    });
    expect(result.unsupported.length).toBeGreaterThan(0);
  });

  it('AC-27-03: Quellenverzeichnis enthält alle genutzten Quellen', () => {
    const list = renderSourceList(sources, new Set([1, 2]));
    expect(list).toContain('## Quellen');
    expect(list).toContain('1. [Quelle 1](https://q1.example/a)');
    expect(list).toContain('2. [Quelle 2](https://q2.example/a)');
    expect(list).not.toContain('3. [Quelle 3]');
  });

  it('segmentiert Sätze', () => {
    expect(splitSentences('Eins. Zwei! Drei?')).toHaveLength(3);
  });
});
