import { describe, expect, it, beforeEach } from 'vitest';
import { openDatabase } from '@/lib/db/client';
import { createRepositories } from '@/lib/db/repositories';
import { VectorStore } from '@/lib/vector/store';
import { VectorIndexer } from '@/lib/vector/indexer';
import { DeterministicEmbeddingProvider } from '@/lib/vector/embeddings';

describe('Vector Indexer', () => {
  let db: ReturnType<typeof openDatabase>;
  let repos: ReturnType<typeof createRepositories>;
  let store: VectorStore;
  let indexer: VectorIndexer;

  beforeEach(() => {
    db = openDatabase(':memory:');
    repos = createRepositories(db);
    store = new VectorStore(db, new DeterministicEmbeddingProvider(128, 'test-128'));
    indexer = new VectorIndexer(store);
  });

  it('indexiert alle statischen Prompt-Vorlagen des Systems', async () => {
    const count = await indexer.indexStaticPrompts();
    expect(count).toBeGreaterThanOrEqual(10);

    const stats = store.stats();
    expect(stats.byType.prompt).toBe(count);

    // Semantische Suche nach Planner
    const results = await store.search({
      query: 'Rechercheaufgabe in Teilfragen zerlegen',
      entityTypes: ['prompt'],
      limit: 1,
    });

    expect(results.length).toBe(1);
    expect(results[0]?.metadata.name).toBe('plannerPrompt');
  });

  it('führt eine vollständige Synchronisierung (syncAll) über generierte Daten aus', async () => {
    repos.users.ensureLocal();
    const conv = repos.conversations.create('usr_local', 'Test-Recherche');
    repos.messages.create(conv.id, 'user', 'Was ist die Hauptstadt von Frankreich?', 'complete');
    repos.messages.create(conv.id, 'assistant', 'Die Hauptstadt von Frankreich ist Paris.', 'complete');

    const run = repos.runs.create({
      conversationId: conv.id,
      userId: 'usr_local',
      requestMessageId: 'msg_req',
      taskType: 'deep_research',
      budgets: {
        maxIterations: 1, maxSearches: 1, maxSources: 1, maxWallClockMs: 1000,
        maxInputTokens: 1000, maxCostMicroUsd: 1000, maxToolCalls: 5,
      },
    });

    repos.sources.upsert({
      runId: run.id,
      conversationId: conv.id,
      url: 'https://de.wikipedia.org/wiki/Paris',
      canonicalUrl: 'https://de.wikipedia.org/wiki/Paris',
      domain: 'wikipedia.org',
      title: 'Paris — Wikipedia',
      sourceType: 'primary',
      trustScore: 0.9,
      status: 'fetched',
    });

    const syncResult = await indexer.syncAll(repos);

    expect(syncResult.indexed).toBeGreaterThanOrEqual(13); // Prompts + Messages + Run + Source
    expect(syncResult.byType.prompt).toBeGreaterThanOrEqual(10);
    expect(syncResult.byType.message).toBe(2);
    expect(syncResult.byType.run).toBe(1);
    expect(syncResult.byType.source).toBe(1);

    // Suche nach "Hauptstadt Paris" im Vector Store
    const searchRes = await store.search({
      query: 'Hauptstadt von Frankreich',
      limit: 3,
    });

    expect(searchRes.length).toBeGreaterThan(0);
    expect(['message', 'source']).toContain(searchRes[0]?.entityType);
  });
});
