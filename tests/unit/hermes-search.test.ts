import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { HermesSearchProvider, hasHermesSearch } from '@/lib/search/hermes';
import { hasSearchProvider, getSearchProvider } from '@/lib/search';
import { resetConfig } from '@/lib/config/env';

// fileURLToPath statt .pathname: der Projektpfad enthält ein Leerzeichen, das sonst als %20 ankommt.
const HOME = fileURLToPath(new URL('../doubles/hermes-home', import.meta.url));

beforeEach(() => {
  process.env.HERMES_HOME = HOME;
  process.env.SEARCH_PROVIDER = 'hermes';
  delete process.env.HERMES_SEARCH_STUB;
  resetConfig();
});

afterEach(() => {
  delete process.env.HERMES_HOME;
  delete process.env.SEARCH_PROVIDER;
  delete process.env.HERMES_SEARCH_STUB;
  resetConfig();
});

describe('Spec 19 — Websuche über Hermes', () => {
  it('erkennt eine vorhandene Hermes-Installation', () => {
    expect(hasHermesSearch()).toBe(true);
    expect(hasSearchProvider()).toBe(true);
    expect(getSearchProvider().name).toBe('Hermes Web');
  });

  it('meldet keine Suche, wenn Hermes fehlt', () => {
    process.env.HERMES_HOME = '/pfad/der/nicht/existiert';
    resetConfig();
    expect(hasHermesSearch()).toBe(false);
  });

  it('wandelt Hermes-Treffer in SearchHits und vergibt fortlaufende Ränge', async () => {
    const hits = await new HermesSearchProvider().search('Wetter Hamburg', { maxResults: 5 });
    expect(hits).toHaveLength(3);
    expect(hits[0]?.title).toBe('Treffer zu Wetter Hamburg');
    expect(hits[0]?.url).toBe('https://beispiel.test/a');
    expect(hits[0]?.snippet).toBe('Beschreibung A');
    expect(hits.map((h) => h.rank)).toEqual([1, 2, 3]);
  });

  it('verwirft Treffer ohne URL und nimmt die URL als Titelersatz', async () => {
    const hits = await new HermesSearchProvider().search('egal', { maxResults: 5 });
    expect(hits.some((h) => h.title === 'ohne URL')).toBe(false);
    expect(hits[2]?.title).toBe('https://beispiel.test/c');
  });

  it('beachtet maxResults', async () => {
    const hits = await new HermesSearchProvider().search('egal', { maxResults: 2 });
    expect(hits).toHaveLength(2);
  });

  it('liefert bei leerem Ergebnis eine leere Liste statt eines Fehlers', async () => {
    process.env.HERMES_SEARCH_STUB = 'empty';
    resetConfig();
    await expect(new HermesSearchProvider().search('egal', { maxResults: 5 })).resolves.toEqual([]);
  });

  it('meldet fehlende Einrichtung als nicht wiederholbaren Fehler', async () => {
    process.env.HERMES_SEARCH_STUB = 'unconfigured';
    resetConfig();
    await expect(new HermesSearchProvider().search('egal', { maxResults: 5 })).rejects.toMatchObject({
      appError: { code: 'SEARCH_NOT_CONFIGURED', retryable: false },
    });
  });

  it('meldet unlesbare Ausgabe als wiederholbaren Fehler', async () => {
    process.env.HERMES_SEARCH_STUB = 'broken';
    resetConfig();
    await expect(new HermesSearchProvider().search('egal', { maxResults: 5 })).rejects.toMatchObject({
      appError: { code: 'SEARCH_FAILED', retryable: true },
    });
  });

  it('meldet einen Absturz des Unterprozesses', async () => {
    process.env.HERMES_SEARCH_STUB = 'crash';
    resetConfig();
    await expect(new HermesSearchProvider().search('egal', { maxResults: 5 })).rejects.toMatchObject({
      appError: { code: 'SEARCH_FAILED' },
    });
  });
});
