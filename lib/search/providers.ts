/** Reale Suchanbieter (Spec 19, FR-19-02). */
import OpenAI from 'openai';
import { z } from 'zod';
import type { SearchOptions, SearchProvider } from './provider';
import type { SearchHit } from '@/lib/contracts/domain';
import { getConfig } from '@/lib/config/env';
import { searchProviderInstruction } from '@/lib/agent/prompts';
import { appError, AppErrorException } from '@/lib/util/errors';

const hitsSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
      publishedAt: z.string().optional(),
    }),
  ),
});

/** Nutzt das gehostete Web-Search-Tool der Responses API als reinen Trefferlieferanten. */
export class OpenAISearchProvider implements SearchProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;

  constructor() {
    const config = getConfig();
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY ?? '', maxRetries: 1 });
  }

  async search(query: string, opts: SearchOptions): Promise<SearchHit[]> {
    const config = getConfig();
    try {
      const response = await this.client.responses.create(
        {
          model: config.OPENAI_MODEL_FAST,
          instructions: searchProviderInstruction,
          input: `Suche: ${query}\nGib bis zu ${opts.maxResults} relevante Ergebnisse zurück.`,
          tools: [{ type: 'web_search' }],
          text: {
            format: {
              type: 'json_schema',
              name: 'search_results',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['results'],
                properties: {
                  results: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['title', 'url', 'snippet', 'publishedAt'],
                      properties: {
                        title: { type: 'string' },
                        url: { type: 'string' },
                        snippet: { type: 'string' },
                        publishedAt: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        } as never,
        { signal: opts.signal as AbortSignal | undefined },
      );
      const parsed = hitsSchema.safeParse(JSON.parse(response.output_text ?? '{"results":[]}'));
      if (!parsed.success) throw new Error(parsed.error.message);
      return parsed.data.results.slice(0, opts.maxResults).map((r, i) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        ...(r.publishedAt ? { publishedAt: r.publishedAt } : {}),
        rank: i + 1,
      }));
    } catch (err) {
      throw new AppErrorException(
        appError('SEARCH_FAILED', `openai search failed: ${(err as Error).message.slice(0, 200)}`),
      );
    }
  }
}

export class BraveSearchProvider implements SearchProvider {
  readonly name = 'brave';

  async search(query: string, opts: SearchOptions): Promise<SearchHit[]> {
    const config = getConfig();
    const url = new URL(`${config.BRAVE_BASE_URL.replace(/\/$/, '')}/web/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(opts.maxResults));
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': config.BRAVE_API_KEY ?? '',
        },
        ...(opts.signal ? { signal: opts.signal } : {}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { web?: { results?: { title?: string; url?: string; description?: string; age?: string }[] } };
      return (data.web?.results ?? []).slice(0, opts.maxResults).map((r, i) => ({
        title: r.title ?? new URL(r.url ?? 'https://unknown.invalid').hostname,
        url: r.url ?? '',
        snippet: r.description ?? '',
        ...(r.age ? { publishedAt: r.age } : {}),
        rank: i + 1,
      })).filter((h) => h.url.length > 0);
    } catch (err) {
      throw new AppErrorException(
        appError('SEARCH_FAILED', `brave search failed: ${(err as Error).message.slice(0, 200)}`),
      );
    }
  }
}

export class TavilySearchProvider implements SearchProvider {
  readonly name = 'tavily';

  async search(query: string, opts: SearchOptions): Promise<SearchHit[]> {
    const config = getConfig();
    try {
      const res = await fetch(`${config.TAVILY_BASE_URL.replace(/\/$/, '')}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: config.TAVILY_API_KEY ?? '',
          query,
          max_results: opts.maxResults,
        }),
        ...(opts.signal ? { signal: opts.signal } : {}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string; published_date?: string }[] };
      return (data.results ?? []).slice(0, opts.maxResults).map((r, i) => ({
        title: r.title ?? 'Ohne Titel',
        url: r.url ?? '',
        snippet: r.content ?? '',
        ...(r.published_date ? { publishedAt: r.published_date } : {}),
        rank: i + 1,
      })).filter((h) => h.url.length > 0);
    } catch (err) {
      throw new AppErrorException(
        appError('SEARCH_FAILED', `tavily search failed: ${(err as Error).message.slice(0, 200)}`),
      );
    }
  }
}
