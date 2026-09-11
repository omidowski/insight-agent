/** Tool für die semantische Suche im Vector Store (Spec 22). */
import { z } from 'zod';
import type { ToolDefinition } from './types';
import { getVectorStore } from '@/lib/vector/store';
import type { VectorEntityType } from '@/lib/vector/types';

const vectorSearchParams = z.object({
  query: z.string().min(1).max(500),
  entityTypes: z
    .array(
      z.enum([
        'prompt',
        'message',
        'run',
        'step',
        'source',
        'excerpt',
        'conflict',
        'citation',
        'tool_call',
      ]),
    )
    .optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

const searchResultItem = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  similarity: z.number(),
  content: z.string(),
  metadata: z.record(z.unknown()),
});

const vectorSearchResult = z.object({
  query: z.string(),
  total: z.number(),
  results: z.array(searchResultItem),
});

export const vectorSearchTool: ToolDefinition<
  z.infer<typeof vectorSearchParams>,
  z.infer<typeof vectorSearchResult>
> = {
  name: 'vector_search',
  description:
    'Sucht semantisch im Vector Store über alle bisher generierten Daten und Prompts ' +
    '(Nachrichten, Recherchequellen, Zitate, Belege, Konflikte, Tool-Aufrufe und Prompt-Vorlagen). ' +
    'Nutze dieses Werkzeug, um frühere Erkenntnisse, Quellen oder Systemprompts abzurufen.',
  parameters: vectorSearchParams,
  result: vectorSearchResult,
  timeoutMs: 3000,
  maxRetries: 1,
  costClass: 'cheap',
  resultTokenBudget: 1500,
  cacheable: true,
  async execute(args, ctx) {
    const store = getVectorStore(ctx.repos.db);
    const limit = args.limit ?? 5;
    const entityTypes = args.entityTypes as VectorEntityType[] | undefined;

    const matches = await store.search({
      query: args.query,
      entityTypes,
      limit,
      minSimilarity: 0.1,
    });

    const results = matches.map((m) => ({
      id: m.id,
      entityType: m.entityType,
      entityId: m.entityId,
      similarity: Math.round(m.similarity * 1000) / 1000,
      content: m.content.slice(0, 1000),
      metadata: m.metadata,
    }));

    return {
      query: args.query,
      total: results.length,
      results,
    };
  },
  summarize: (r) => {
    if (r.results.length === 0) {
      return `Keine Treffer für "${r.query}" im Vector Store gefunden.`;
    }
    const top = r.results[0]!;
    const pct = Math.round(top.similarity * 100);
    return `${r.results.length} Treffer für "${r.query}" (Bester Treffer: ${top.entityType} mit ${pct}% Ähnlichkeit).`;
  },
};
