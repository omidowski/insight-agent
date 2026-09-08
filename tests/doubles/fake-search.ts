/** Deterministischer Test-Double für `SearchProvider` über lokale Testseiten (Spec 42). */
import type { SearchProvider, SearchOptions } from '@/lib/search/provider';
import type { SearchHit } from '@/lib/contracts/domain';
import { TEST_PAGES, testPageUrl } from './pages';

export class FakeSearchProvider implements SearchProvider {
  readonly name = 'fake';
  constructor(private readonly origin: string = '') {}

  async search(query: string, opts: SearchOptions): Promise<SearchHit[]> {
    // Generische Begriffe identifizieren kein Thema — sonst träfe „statistiken" jede Sportseite.
    const GENERIC = new Set([
      'statistik', 'statistiken', 'daten', 'zahlen', 'aktuell', 'aktuelle', 'aktuellen', 'analyse',
      'überblick', 'vergleich', 'profil', 'belegt', 'belegte', 'belegten', 'grunddaten', 'kennzahlen',
      'angaben', 'quellen', 'information', 'informationen', 'welche', 'gibt',
      'und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'für', 'mit', 'von', 'zum', 'zur', 'sind',
    ]);
    // Nur Wortanfänge vergleichen, nie Teilstrings: „und" darf nicht „bundesliga" treffen.
    const terms = query
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 4 && !GENERIC.has(t));
    const stemMatch = (a: string, b: string) =>
      a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

    const scored = TEST_PAGES.filter((p) => p.slug !== 'injection-trap').map((page) => {
      let score = 0;
      for (const term of terms) {
        if (page.keywords.some((k) => !GENERIC.has(k) && stemMatch(k, term))) score += 3;
        const titleWords = page.title.toLowerCase().split(/[^\p{L}\p{N}]+/u);
        const snippetWords = page.snippet.toLowerCase().split(/[^\p{L}\p{N}]+/u);
        if (titleWords.some((w) => stemMatch(w, term))) score += 2;
        if (snippetWords.some((w) => stemMatch(w, term))) score += 1;
      }
      return { page, score };
    });

    // Kein Ersatztreffer bei fehlender Übereinstimmung: der Agent soll ehrlich melden,
    // dass es zu diesem Thema keine Demo-Quellen gibt (Spec 24, FR-24-08).
    const matches = scored.filter((s) => s.score >= 3).sort((a, b) => b.score - a.score);

    return matches.slice(0, opts.maxResults).map((m, index) => ({
      title: m.page.title,
      url: testPageUrl(m.page.slug, this.origin),
      snippet: m.page.snippet,
      ...(m.page.publishedAt ? { publishedAt: m.page.publishedAt } : {}),
      rank: index + 1,
    }));
  }
}
