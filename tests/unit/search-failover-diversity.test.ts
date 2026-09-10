import { describe, expect, it, vi } from 'vitest';
import {
  diversifyQueries,
  normalizeQuery,
  nearDuplicateQuery,
} from '@/lib/agent/research/query-diversity';
import {
  FailoverSearchProvider,
  buildFailoverChain,
} from '@/lib/search/failover';
import type { SearchProvider, SearchOptions } from '@/lib/search/provider';
import type { SearchHit } from '@/lib/contracts/domain';
import { AppErrorException, appError } from '@/lib/util/errors';

function hit(url: string): SearchHit {
  return { title: url, url, snippet: 'x', rank: 1 };
}

function provider(name: string, impl: SearchProvider['search']): SearchProvider {
  return { name, search: impl };
}

describe('IAAR-0301 — query diversity', () => {
  it('normalizes case, punctuation and whitespace', () => {
    expect(normalizeQuery('  Bayern,,  Musiala!!  ')).toBe('bayern musiala');
  });

  it('detects near-duplicate queries (same tokens / high overlap)', () => {
    expect(nearDuplicateQuery('Musiala Tore 2025', 'musiala tore 2025')).toBe(true);
    expect(nearDuplicateQuery('Musiala Tore 2025', 'Musiala Tore Saison 2025/26')).toBe(true);
    expect(nearDuplicateQuery('Wetter Hamburg', 'FC Bayern Umsatz')).toBe(false);
  });

  it('drops exact and near-duplicate queries against previous set', () => {
    const previous = new Set(['musiala tore 2025']);
    const out = diversifyQueries(
      ['Musiala Tore 2025', 'Musiala Tore Saison 2025', 'Bayern Kader 2026', 'x'],
      previous,
      3,
    );
    expect(out).toEqual(['Bayern Kader 2026']);
  });
});

describe('IAAR-0301 — multi-provider search failover', () => {
  it('buildFailoverChain prefers openai → brave → tavily when keys exist', () => {
    const chain = buildFailoverChain({
      openai: true,
      brave: true,
      tavily: true,
    });
    expect(chain).toEqual(['openai', 'brave', 'tavily']);
  });

  it('skips unavailable providers in the chain', () => {
    expect(buildFailoverChain({ openai: false, brave: true, tavily: true })).toEqual([
      'brave',
      'tavily',
    ]);
  });

  it('fails over to the next provider when the primary throws SEARCH_FAILED', async () => {
    const primary = provider('openai', async () => {
      throw new AppErrorException(appError('SEARCH_FAILED', 'openai down'));
    });
    const secondary = provider('brave', async () => [hit('https://brave.example/a')]);
    const tertiary = provider('tavily', async () => [hit('https://tavily.example/a')]);

    const failover = new FailoverSearchProvider([primary, secondary, tertiary]);
    const hits = await failover.search('query', { maxResults: 3 });
    expect(failover.name).toBe('failover');
    expect(hits[0]?.url).toBe('https://brave.example/a');
  });

  it('returns empty only after every provider fails', async () => {
    const boom = async () => {
      throw new AppErrorException(appError('SEARCH_FAILED', 'down'));
    };
    const failover = new FailoverSearchProvider([
      provider('openai', boom),
      provider('brave', boom),
      provider('tavily', boom),
    ]);
    await expect(failover.search('q', { maxResults: 1 } as SearchOptions)).rejects.toBeInstanceOf(
      AppErrorException,
    );
  });

  it('does not call later providers when an earlier one succeeds', async () => {
    const later = vi.fn(async () => [hit('https://later.example')]);
    const failover = new FailoverSearchProvider([
      provider('openai', async () => [hit('https://openai.example')]),
      provider('brave', later),
    ]);
    const hits = await failover.search('q', { maxResults: 1 });
    expect(hits[0]?.url).toBe('https://openai.example');
    expect(later).not.toHaveBeenCalled();
  });
});
