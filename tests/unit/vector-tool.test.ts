import { describe, expect, it, beforeEach } from 'vitest';
import { openDatabase } from '@/lib/db/client';
import { createRepositories } from '@/lib/db/repositories';
import { vectorSearchTool } from '@/lib/tools/vector-search';
import type { ToolContext } from '@/lib/tools/types';
import { getConfig } from '@/lib/config/env';
import { logger } from '@/lib/util/logger';

describe('Tool: vector_search', () => {
  let db: ReturnType<typeof openDatabase>;
  let repos: ReturnType<typeof createRepositories>;

  beforeEach(() => {
    db = openDatabase(':memory:');
    repos = createRepositories(db);
    repos.users.ensureLocal();
  });

  function createMockCtx(): ToolContext {
    return {
      runId: 'run_test',
      conversationId: 'cnv_test',
      stepId: 'stp_1',
      signal: new AbortController().signal,
      emitter: { emit: () => {} } as never,
      repos,
      config: getConfig(),
      logger,
      search: {} as never,
      cache: new Map(),
      consume: () => {},
    };
  }

  it('führt Vektorsuche über indexierte Daten aus und liefert strukturierte Ergebnisse', async () => {
    // 1. Indexiere Daten
    const conv = repos.conversations.create('usr_local', 'Quantenphysik');
    repos.messages.create(conv.id, 'user', 'Erkläre Quantenverschränkung und Qubits.', 'complete');

    await repos.vectors.syncAll();

    const ctx = createMockCtx();
    const result = await vectorSearchTool.execute(
      { query: 'Quantenverschränkung Qubits', limit: 3 },
      ctx,
    );

    expect(result.query).toBe('Quantenverschränkung Qubits');
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0]?.similarity).toBeGreaterThan(0.2);

    const summary = vectorSearchTool.summarize(result);
    expect(summary).toContain('Treffer');
  });

  it('filtert nach spezifischen entityTypes', async () => {
    await repos.vectors.syncAll();

    const ctx = createMockCtx();
    const result = await vectorSearchTool.execute(
      { query: 'Recherche Router Klassifikation', entityTypes: ['prompt'], limit: 2 },
      ctx,
    );

    expect(result.results.length).toBeGreaterThan(0);
    for (const r of result.results) {
      expect(r.entityType).toBe('prompt');
    }
  });
});
