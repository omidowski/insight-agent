/** Recherche einer Teilfrage: suchen, lesen, extrahieren, vergleichen (Spec 24). */
import type { LLMProvider } from '@/lib/llm/provider';
import type { AppConfig } from '@/lib/config/env';
import type { Repositories } from '@/lib/db/repositories';
import type { ExtractionItem, PlanStep, StepResult, ToolName } from '@/lib/contracts/domain';
import type { EventEmitterLike } from '../events';
import type { RunStateManager } from '../state';
import type { ToolContext } from '@/lib/tools/types';
import type { SearchProvider } from '@/lib/search/provider';
import { executeTool } from '@/lib/tools/registry';
import { pageCacheKey } from '@/lib/tools/web';
import type { FetchedPage } from '@/lib/tools/fetch-page';
import { extractionPrompt, queryGenPrompt } from '../prompts';
import { extractionOutputSchema, queryOutputSchema } from '@/lib/contracts/schemas';
import { locateExcerpt } from '@/lib/util/html';
import { classifySource, reputationScore, recencyScore } from './source-scoring';
import { mapLimit } from '@/lib/util/concurrency';
import { domainOf } from '@/lib/util/url-safety';
import { logger } from '@/lib/util/logger';
import { isAbort, toAppError } from '@/lib/util/errors';

export interface ResearchContext {
  runId: string;
  conversationId: string;
  llm: LLMProvider;
  repos: Repositories;
  emitter: EventEmitterLike;
  state: RunStateManager;
  config: AppConfig;
  search: SearchProvider;
  cache: Map<string, unknown>;
  allowedTools: ToolName[];
  /** Bereits gestellte Suchanfragen (normalisiert) — verhindert Wiederholungen. */
  queries: Set<string>;
}

function toolCtx(ctx: ResearchContext, stepId: string | null): ToolContext {
  return {
    runId: ctx.runId,
    conversationId: ctx.conversationId,
    stepId,
    signal: ctx.state.signal,
    emitter: ctx.emitter,
    repos: ctx.repos,
    config: ctx.config,
    logger,
    search: ctx.search,
    cache: ctx.cache,
    consume: (kind) => ctx.state.consume(kind),
  };
}

interface Candidate {
  url: string;
  title: string;
  domain: string;
  publishedAt?: string;
  score: number;
}

export async function generateQueries(ctx: ResearchContext, step: PlanStep): Promise<string[]> {
  const prompt = queryGenPrompt(step.question, Array.from(ctx.queries));
  try {
    const output = await ctx.llm.generateObject({
      system: prompt.system,
      input: prompt.input,
      model: 'fast',
      schema: queryOutputSchema,
      schemaName: 'search_queries',
      purpose: 'queries',
      signal: ctx.state.signal,
      runId: ctx.runId,
    });
    const cleaned = output.queries
      .map((q) => q.replace(/\s+/g, ' ').trim())
      .filter((q) => q.length > 2)
      .filter((q) => !ctx.queries.has(q.toLowerCase()))
      .slice(0, ctx.config.MAX_QUERIES_PER_STEP);
    return cleaned.length > 0 ? cleaned : [step.question.slice(0, 120)];
  } catch (err) {
    if (isAbort(err)) throw err;
    return [step.question.slice(0, 120)];
  }
}

export async function researchStep(ctx: ResearchContext, step: PlanStep): Promise<StepResult> {
  ctx.emitter.emit('step.started', { stepId: step.id, title: step.title });

  const queries = await generateQueries(ctx, step);
  const candidates = new Map<string, Candidate>();

  for (const query of queries) {
    if (!ctx.state.hasBudgetForResearch()) break;
    ctx.queries.add(query.toLowerCase());
    const outcome = await executeTool('web_search', { query }, toolCtx(ctx, step.id), ctx.allowedTools);
    if (!outcome.ok) continue;
    const { results } = outcome.result as {
      results: { title: string; url: string; snippet: string; domain: string; publishedAt?: string; seen: boolean }[];
    };
    for (const hit of results) {
      if (hit.seen || candidates.has(hit.url)) continue;
      const type = classifySource(hit.domain);
      const score =
        0.5 * reputationScore(hit.domain) +
        0.3 * recencyScore(hit.publishedAt ?? null) +
        0.2 * (type === 'primary' ? 1 : type === 'secondary' ? 0.7 : 0.5);
      candidates.set(hit.url, {
        url: hit.url, title: hit.title, domain: hit.domain,
        ...(hit.publishedAt ? { publishedAt: hit.publishedAt } : {}),
        score,
      });
    }
  }

  // Auswahl: nach Score, mit Domainvielfalt (Spec 26, FR-26-05)
  const perDomain = new Map<string, number>();
  const selected: Candidate[] = [];
  for (const candidate of Array.from(candidates.values()).sort((a, b) => b.score - a.score)) {
    const used = perDomain.get(candidate.domain) ?? 0;
    if (used >= ctx.config.MAX_SOURCES_PER_DOMAIN) continue;
    perDomain.set(candidate.domain, used + 1);
    selected.push(candidate);
    if (selected.length >= ctx.config.MAX_SOURCES_PER_STEP) break;
  }

  const opened = await mapLimit(selected, ctx.config.STEP_CONCURRENCY, async (candidate) => {
    if (!ctx.state.hasBudgetForResearch()) return undefined;
    const outcome = await executeTool(
      'open_url', { url: candidate.url, title: candidate.title }, toolCtx(ctx, step.id), ctx.allowedTools,
    );
    if (!outcome.ok) return undefined;
    const result = outcome.result as { sourceId: string; index: number; status: string; domain: string };
    return result.status === 'fetched' ? result : undefined;
  });

  const usable = opened.filter((o): o is { sourceId: string; index: number; status: string; domain: string } => Boolean(o));
  const items: ExtractionItem[] = [];
  const usedSourceIds: string[] = [];

  for (const source of usable) {
    if (ctx.state.checkCancellation()) break;
    const page = ctx.cache.get(pageCacheKey(source.sourceId)) as FetchedPage | undefined;
    if (!page) continue;

    const extractOutcome = await executeTool(
      'extract_content', { sourceId: source.sourceId, focus: step.question },
      toolCtx(ctx, step.id), ctx.allowedTools,
    );
    const focusText = extractOutcome.ok
      ? (extractOutcome.result as { text: string }).text
      : page.text.slice(0, ctx.config.EXTRACTION_MAX_CHARS);

    const record = ctx.repos.sources.listByRun(ctx.runId).find((s) => s.id === source.sourceId);
    const prompt = extractionPrompt(
      step.question, source.index, source.domain, record?.fetchedAt ?? null, focusText,
    );
    try {
      const output = await ctx.llm.generateObject({
        system: prompt.system,
        input: prompt.input,
        model: 'fast',
        schema: extractionOutputSchema,
        schemaName: 'source_extraction',
        purpose: 'extraction',
        signal: ctx.state.signal,
        runId: ctx.runId,
      });

      let verified = 0;
      for (const item of output.items) {
        const position = locateExcerpt(page.text, item.excerpt);
        if (!position) {
          logger.warn('excerpt not found — verworfen', {
            module: 'research', runId: ctx.runId, sourceId: source.sourceId,
          });
          continue;
        }
        ctx.repos.excerpts.create({
          sourceId: source.sourceId,
          runId: ctx.runId,
          text: item.excerpt.slice(0, 2000),
          startOffset: position.startOffset,
          endOffset: position.endOffset,
          claimKey: item.claimKey,
          extractedValue: item.value,
        });
        items.push({ ...item, sourceId: source.sourceId });
        verified++;
      }
      if (verified > 0 && !usedSourceIds.includes(source.sourceId)) usedSourceIds.push(source.sourceId);
      ctx.emitter.emit('source.extracted', {
        sourceId: source.sourceId, index: source.index,
        excerptCount: verified, summary: output.summary.slice(0, 200),
      });
    } catch (err) {
      if (isAbort(err)) throw err;
      logger.warn('extraction failed', {
        module: 'research', runId: ctx.runId, sourceId: source.sourceId,
        error: toAppError(err).code,
      });
    }
  }

  const answer = items.length > 0
    ? items.slice(0, 6).map((i) => `${i.label}: ${i.value}`).join('; ')
    : '';
  const confidence = items.length === 0 ? 0 : Math.min(1, 0.4 + 0.15 * usedSourceIds.length);

  const result: StepResult = {
    stepId: step.id,
    answer,
    sourceIds: usedSourceIds,
    items,
    confidence,
    ...(items.length === 0
      ? { note: usable.length === 0
          ? 'Keine Quelle konnte geöffnet werden.'
          : 'Die geöffneten Quellen enthielten keine passenden Angaben.' }
      : {}),
  };

  ctx.emitter.emit('step.completed', {
    stepId: step.id,
    summary: items.length > 0
      ? `${items.length} Angaben aus ${usedSourceIds.length} Quellen`
      : (result.note ?? 'Kein Ergebnis'),
    status: items.length > 0 ? 'completed' : 'failed',
  });
  return result;
}

export { domainOf };
