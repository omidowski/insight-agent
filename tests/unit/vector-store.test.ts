import { describe, expect, it, beforeEach } from 'vitest';
import { openDatabase } from '@/lib/db/client';
import { VectorStore } from '@/lib/vector/store';
import { DeterministicEmbeddingProvider } from '@/lib/vector/embeddings';

describe('Vector Store (SQLite)', () => {
  let db: ReturnType<typeof openDatabase>;
  let store: VectorStore;

  beforeEach(() => {
    db = openDatabase(':memory:');
    store = new VectorStore(db, new DeterministicEmbeddingProvider(128, 'test-det-128'));
  });

  it('erstellt Vektoreintrag und findet ihn per ID und Entity-Typ', async () => {
    const record = await store.upsert({
      entityType: 'prompt',
      entityId: 'p_router',
      content: 'Router-Prompt zur Klassifikation von Nutzeranfragen',
      metadata: { version: 'v1', task: 'routing' },
    });

    expect(record.id).toMatch(/^vec_/);
    expect(record.entityType).toBe('prompt');
    expect(record.dimensions).toBe(128);

    const fetched = store.get(record.id);
    expect(fetched).toBeDefined();
    expect(fetched?.content).toBe(record.content);
    expect(fetched?.metadata).toEqual({ version: 'v1', task: 'routing' });

    const byEntity = store.getByEntity('prompt', 'p_router');
    expect(byEntity?.id).toBe(record.id);
  });

  it('führt Kosinus-Ähnlichkeitssuche mit Filtern aus', async () => {
    await store.upsertBatch([
      {
        entityType: 'message',
        entityId: 'msg_1',
        content: 'Wie viele Tore hat Jamal Musiala in dieser Saison erzielt?',
        metadata: { role: 'user' },
      },
      {
        entityType: 'source',
        entityId: 'src_1',
        content: 'Offizielle Bundesliga-Statistik: Jamal Musiala erzielte 15 Tore.',
        metadata: { domain: 'bundesliga.com' },
      },
      {
        entityType: 'prompt',
        entityId: 'p_syntax',
        content: 'System-Prompt für JSON-Formatierung und Typvalidierung',
        metadata: { purpose: 'formatting' },
      },
    ]);

    // Suche nach Fußball/Tore
    const matches = await store.search({
      query: 'Musiala Tore Bundesliga',
      limit: 2,
    });

    expect(matches.length).toBeGreaterThan(0);
    // Bester Treffer sollte mit Fußball/Musiala zu tun haben
    expect(['message', 'source']).toContain(matches[0]?.entityType);
    expect(matches[0]?.similarity).toBeGreaterThan(0.3);

    // Filter nach nur 'prompt'
    const promptMatches = await store.search({
      query: 'System Prompt Formatierung',
      entityTypes: ['prompt'],
    });

    expect(promptMatches.length).toBe(1);
    expect(promptMatches[0]?.entityType).toBe('prompt');
  });

  it('liefert korrekte Store-Statistiken', async () => {
    await store.upsert({ entityType: 'message', entityId: 'm1', content: 'Hallo' });
    await store.upsert({ entityType: 'message', entityId: 'm2', content: 'Welt' });
    await store.upsert({ entityType: 'source', entityId: 's1', content: 'Quelle' });

    const stats = store.stats();
    expect(stats.total).toBe(3);
    expect(stats.byType.message).toBe(2);
    expect(stats.byType.source).toBe(1);
    expect(stats.byType.prompt).toBe(0);
    expect(stats.dimensions).toBe(128);
  });

  it('löscht Einträge nach ID und nach Entity', async () => {
    const r = await store.upsert({ entityType: 'conflict', entityId: 'c1', content: 'Widerspruch' });
    expect(store.count('conflict')).toBe(1);

    const deleted = store.delete(r.id);
    expect(deleted).toBe(true);
    expect(store.count('conflict')).toBe(0);

    await store.upsert({ entityType: 'conflict', entityId: 'c2', content: 'Widerspruch 2' });
    expect(store.deleteByEntity('conflict', 'c2')).toBe(true);
    expect(store.count('conflict')).toBe(0);
  });
});
