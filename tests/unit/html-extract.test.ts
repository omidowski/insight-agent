import { describe, expect, it } from 'vitest';
import { extractContent, locateExcerpt, searchInText } from '@/lib/util/html';
import { TEST_PAGES } from '../doubles/pages';

const page = TEST_PAGES.find((p) => p.slug === 'musiala-bundesliga')!;

describe('Spec 20 — HTML-Extraktion', () => {
  it('AC-20-02: extrahiert Fließtext ohne Navigation, Skripte und Werbung', () => {
    const result = extractContent(page.html, 'https://bundesliga.example/x');
    expect(result.text).toContain('28 Bundesliga-Einsätze');
    expect(result.text).not.toContain('Impressum');
    expect(result.text).not.toContain('tracking');
    expect(result.text).not.toContain('Werbung');
    expect(result.title).toContain('Musiala');
  });

  it('AC-20-03: liest Veröffentlichungsdatum aus JSON-LD/meta', () => {
    const result = extractContent(page.html, 'https://bundesliga.example/x');
    expect(result.publishedAt).toBe('2026-08-20T09:00:00.000Z');
    expect(result.author).toBe('Bundesliga Redaktion');
  });

  it('wandelt Tabellen in Markdown', () => {
    const result = extractContent(page.html, 'https://bundesliga.example/x');
    expect(result.text).toMatch(/\|\s*Einsätze\s*\|/);
  });

  it('kommt mit kaputtem HTML zurecht', () => {
    const result = extractContent('<html><body><p>Hallo <b>Welt</p></body>', 'https://x.example/');
    expect(result.text).toContain('Hallo');
  });

  it('AC-20-06 / AC-24-02: Fundstellen und Excerpt-Offsets sind korrekt', () => {
    const result = extractContent(page.html, 'https://bundesliga.example/x');
    const matches = searchInText(result.text, 'Vorlagen');
    expect(matches.length).toBeGreaterThan(0);
    expect(result.text.slice(matches[0]!.startOffset, matches[0]!.endOffset)).toContain('Vorlagen');

    const sentence = 'erzielte er 14 Tore';
    const located = locateExcerpt(result.text, sentence);
    expect(located).toBeDefined();
    expect(result.text.slice(located!.startOffset, located!.endOffset)).toContain('14 Tore');
  });

  it('AC-24-03: erfundene Excerpts werden nicht lokalisiert', () => {
    const result = extractContent(page.html, 'https://bundesliga.example/x');
    expect(locateExcerpt(result.text, 'Musiala erzielte 99 Tore in der Champions League')).toBeUndefined();
  });

  it('toleriert abweichende Whitespaces im Excerpt', () => {
    const result = extractContent(page.html, 'https://bundesliga.example/x');
    expect(locateExcerpt(result.text, 'erzielte   er   14   Tore')).toBeDefined();
  });
});
