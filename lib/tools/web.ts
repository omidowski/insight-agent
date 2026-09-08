/** Recherche-Tools: Suche, Seitenabruf, Extraktion, Seitensuche (Spec 19/20). */
import { z } from 'zod';
import type { ToolContext, ToolDefinition } from './types';
import { canonicalizeUrl, domainOf } from '@/lib/util/url-safety';
import { fetchPage, type FetchedPage } from './fetch-page';
import { searchInText } from '@/lib/util/html';
import { relevantExcerptText } from '@/lib/util/tokens';
import { classifySource, trustScoreFor } from '@/lib/agent/research/source-scoring';
import { scanUntrusted, hasHighSeverity } from '@/lib/agent/safety';
import { appError, AppErrorException } from '@/lib/util/errors';

export const pageCacheKey = (sourceId: string) => `page:${sourceId}`;

const searchParams = z.object({
  query: z.string().min(2).max(200),
  maxResults: z.number().int().min(1).max(10).optional(),
});
const searchResult = z.object({
  results: z.array(
    z.object({
      title: z.string(), url: z.string(), snippet: z.string(),
      domain: z.string(), publishedAt: z.string().optional(), seen: z.boolean(),
    }),
  ),
});

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, ' ').replace(/[\r\n]/g, ' ').trim().slice(0, 200);
}

export const webSearchTool: ToolDefinition<z.infer<typeof searchParams>, z.infer<typeof searchResult>> = {
  name: 'web_search',
  description:
    'Sucht im Web nach Quellen zu einer Suchanfrage. Liefert Titel, URL und Kurzbeschreibung. Öffne relevante Treffer anschließend mit open_url.',
  parameters: searchParams,
  result: searchResult,
  timeoutMs: 20000,
  maxRetries: 1,
  costClass: 'cheap',
  resultTokenBudget: 1200,
  cacheable: true,
  async execute(args, ctx) {
    ctx.consume('search');
    const query = normalizeQuery(args.query);
    const provider = ctx.search;
    const max = args.maxResults ?? ctx.config.SEARCH_MAX_RESULTS;
    const hits = await provider.search(query, {
      maxResults: max,
      signal: ctx.signal,
    });

    const known = new Set(ctx.repos.sources.listByRun(ctx.runId).map((s) => s.canonicalUrl));
    const seenCanonical = new Set<string>();
    const results: z.infer<typeof searchResult>['results'] = [];
    for (const hit of hits) {
      let canonical: string;
      try {
        canonical = canonicalizeUrl(hit.url);
      } catch {
        continue;
      }
      if (seenCanonical.has(canonical)) continue;
      seenCanonical.add(canonical);
      results.push({
        title: hit.title || domainOf(hit.url),
        url: hit.url,
        snippet: hit.snippet.slice(0, 300),
        domain: domainOf(hit.url),
        ...(hit.publishedAt ? { publishedAt: hit.publishedAt } : {}),
        seen: known.has(canonical),
      });
    }

    ctx.emitter.emit('search.results', {
      query,
      count: results.length,
      topDomains: Array.from(new Set(results.map((r) => r.domain))).slice(0, 5),
    });
    return { results };
  },
  summarize: (r) => `${r.results.length} Treffer`,
};

const openParams = z.object({ url: z.string().min(5), title: z.string().optional() });
const openResult = z.object({
  sourceId: z.string(), index: z.number(), title: z.string(), domain: z.string(),
  publishedAt: z.string().nullable(), textLength: z.number(), preview: z.string(),
  status: z.string(), note: z.string().optional(),
});

export const openUrlTool: ToolDefinition<z.infer<typeof openParams>, z.infer<typeof openResult>> = {
  name: 'open_url',
  description:
    'Öffnet eine zuvor über web_search gefundene URL, extrahiert den Textinhalt und legt sie als zitierfähige Quelle an.',
  parameters: openParams,
  result: openResult,
  timeoutMs: 20000,
  maxRetries: 1,
  costClass: 'cheap',
  resultTokenBudget: 800,
  cacheable: true,
  async execute(args, ctx) {
    ctx.consume('source');
    const canonical = canonicalizeUrl(args.url);
    const domain = domainOf(args.url);

    const existing = ctx.repos.sources.listByRun(ctx.runId).find((s) => s.canonicalUrl === canonical);
    if (existing && existing.status === 'fetched') {
      const cached = ctx.cache.get(pageCacheKey(existing.id)) as FetchedPage | undefined;
      return {
        sourceId: existing.id, index: existing.indexNum, title: existing.title,
        domain: existing.domain, publishedAt: existing.publishedAt,
        textLength: existing.rawTextLen, preview: (cached?.text ?? '').slice(0, 600),
        status: existing.status,
      };
    }

    if (ctx.repos.sources.countByDomain(ctx.runId, domain) >= ctx.config.MAX_SOURCES_PER_DOMAIN && !existing) {
      throw new AppErrorException(
        appError('TOOL_FAILED', `Domain-Limit erreicht für ${domain}`, {
          userMessage: `Es wurden bereits genügend Quellen von ${domain} verwendet.`,
        }),
      );
    }

    const source = ctx.repos.sources.upsert({
      runId: ctx.runId,
      conversationId: ctx.conversationId,
      url: args.url,
      canonicalUrl: canonical,
      domain,
      title: args.title ?? domain,
      sourceType: classifySource(domain),
      trustScore: 0.4,
      status: 'discovered',
    });

    try {
      const page = await fetchPage(args.url, ctx.signal);
      if (page.text.trim().length < 200) {
        ctx.repos.sources.update(source.id, { status: 'skipped', note: 'Kein verwertbarer Textinhalt' });
        return {
          sourceId: source.id, index: source.indexNum, title: page.title || source.title,
          domain, publishedAt: page.publishedAt, textLength: page.textLength,
          preview: '', status: 'skipped', note: 'Kein verwertbarer Textinhalt',
        };
      }

      const duplicate = ctx.repos.sources.findByHash(ctx.runId, page.contentHash);
      if (duplicate && duplicate.id !== source.id) {
        ctx.repos.sources.update(source.id, { status: 'skipped', note: `Inhaltsgleich mit Quelle ${duplicate.indexNum}` });
        const cached = ctx.cache.get(pageCacheKey(duplicate.id)) as FetchedPage | undefined;
        return {
          sourceId: duplicate.id, index: duplicate.indexNum, title: duplicate.title,
          domain: duplicate.domain, publishedAt: duplicate.publishedAt,
          textLength: duplicate.rawTextLen, preview: (cached?.text ?? '').slice(0, 600),
          status: 'fetched', note: 'Duplikat',
        };
      }

      const findings = scanUntrusted(page.text);
      if (findings.length > 0) {
        for (const finding of findings) {
          ctx.emitter.emit('safety.flagged', {
            sourceId: source.id, pattern: finding.pattern, severity: finding.severity,
          });
        }
        ctx.logger.warn('safety.injection_suspected', {
          module: 'tools', runId: ctx.runId, sourceId: source.id,
          patterns: findings.map((f) => f.pattern),
        });
      }

      const sourceType = classifySource(domain);
      ctx.repos.sources.update(source.id, {
        title: page.title || source.title,
        author: page.author,
        publishedAt: page.publishedAt,
        fetchedAt: page.fetchedAt,
        contentHash: page.contentHash,
        rawTextLen: page.textLength,
        sourceType,
        trustScore: trustScoreFor({ domain, sourceType, publishedAt: page.publishedAt, agreement: 0 }),
        status: 'fetched',
        note: hasHighSeverity(findings)
          ? 'Enthält eingebettete Anweisungen — nur als Datenquelle behandelt'
          : page.paywalled ? 'Paywall erkannt' : null,
      });
      ctx.cache.set(pageCacheKey(source.id), page);

      ctx.emitter.emit('source.opened', {
        sourceId: source.id, index: source.indexNum, url: args.url,
        domain, title: page.title || source.title,
      });

      return {
        sourceId: source.id, index: source.indexNum, title: page.title || source.title,
        domain, publishedAt: page.publishedAt, textLength: page.textLength,
        preview: page.text.slice(0, 600), status: 'fetched',
      };
    } catch (err) {
      const code = (err as { appError?: { code?: string } }).appError?.code ?? 'FETCH_FAILED';
      ctx.repos.sources.update(source.id, { status: 'failed', note: `Abruf fehlgeschlagen (${code})` });
      throw err;
    }
  },
  summarize: (r) => (r.status === 'fetched' ? `${r.domain} gelesen (${r.textLength} Zeichen)` : `${r.domain}: ${r.status}`),
};

const extractParams = z.object({ sourceId: z.string(), focus: z.string().max(300) });
const extractResult = z.object({ sourceId: z.string(), index: z.number(), text: z.string(), truncated: z.boolean() });

export const extractContentTool: ToolDefinition<z.infer<typeof extractParams>, z.infer<typeof extractResult>> = {
  name: 'extract_content',
  description: 'Liefert die zur Fragestellung relevantesten Textabschnitte einer bereits geöffneten Quelle.',
  parameters: extractParams,
  result: extractResult,
  timeoutMs: 5000,
  maxRetries: 0,
  costClass: 'free',
  resultTokenBudget: 3000,
  cacheable: true,
  async execute(args, ctx) {
    const page = ctx.cache.get(pageCacheKey(args.sourceId)) as FetchedPage | undefined;
    const source = ctx.repos.sources.listByRun(ctx.runId).find((s) => s.id === args.sourceId);
    if (!page || !source) {
      throw new AppErrorException(appError('VALIDATION_FAILED', 'Quelle wurde nicht geöffnet'));
    }
    const text = relevantExcerptText(page.text, args.focus, ctx.config.EXTRACTION_MAX_CHARS);
    return {
      sourceId: args.sourceId, index: source.indexNum, text,
      truncated: text.length < page.text.length,
    };
  },
  summarize: (r) => `Quelle ${r.index}: ${r.text.length} Zeichen extrahiert`,
};

const searchPageParams = z.object({ sourceId: z.string(), query: z.string().min(2).max(120) });
const searchPageResult = z.object({
  matches: z.array(z.object({ text: z.string(), startOffset: z.number(), endOffset: z.number() })),
});

export const searchInPageTool: ToolDefinition<z.infer<typeof searchPageParams>, z.infer<typeof searchPageResult>> = {
  name: 'search_in_page',
  description: 'Sucht einen Begriff innerhalb einer geöffneten Quelle und liefert Fundstellen mit Kontext.',
  parameters: searchPageParams,
  result: searchPageResult,
  timeoutMs: 3000,
  maxRetries: 0,
  costClass: 'free',
  resultTokenBudget: 800,
  cacheable: true,
  async execute(args, ctx) {
    const page = ctx.cache.get(pageCacheKey(args.sourceId)) as FetchedPage | undefined;
    if (!page) throw new AppErrorException(appError('VALIDATION_FAILED', 'Quelle wurde nicht geöffnet'));
    return { matches: searchInText(page.text, args.query) };
  },
  summarize: (r) => `${r.matches.length} Fundstellen`,
};
