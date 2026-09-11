import { describe, expect, it, beforeAll } from 'vitest';
import { GET as searchGet } from '@/app/api/vector/search/route';
import { GET as statsGet } from '@/app/api/vector/stats/route';
import { POST as syncPost } from '@/app/api/vector/sync/route';
import { getRepositories } from '@/lib/db/repositories';

describe('Vector DB API Routes', () => {
  beforeAll(async () => {
    const repos = getRepositories();
    repos.users.ensureLocal();
    await repos.vectors.syncAll();
  });

  it('GET /api/vector/stats liefert Vektorstatistiken', async () => {
    const req = new Request('http://127.0.0.1:3000/api/vector/stats');
    const res = await statsGet(req);
    expect(res.status).toBe(200);

    const data = (await res.json()) as { ok: boolean; stats: { total: number; dimensions: number } };
    expect(data.ok).toBe(true);
    expect(data.stats.total).toBeGreaterThanOrEqual(10);
    expect(data.stats.dimensions).toBeGreaterThan(0);
  });

  it('GET /api/vector/search liefert semantische Treffer', async () => {
    const req = new Request('http://127.0.0.1:3000/api/vector/search?q=Synthese+Quellen&limit=3');
    const res = await searchGet(req);
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      ok: boolean;
      query: string;
      total: number;
      results: Array<{ id: string; similarity: number; entityType: string }>;
    };
    expect(data.ok).toBe(true);
    expect(data.query).toBe('Synthese Quellen');
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results[0]?.similarity).toBeGreaterThan(0);
  });

  it('POST /api/vector/sync synchronisiert alle Daten und Prompts', async () => {
    const req = new Request('http://127.0.0.1:3000/api/vector/sync', { method: 'POST' });
    const res = await syncPost(req);
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      ok: boolean;
      indexed: number;
      byType: Record<string, number>;
      durationMs: number;
    };
    expect(data.ok).toBe(true);
    expect(data.indexed).toBeGreaterThanOrEqual(10);
    expect(data.byType.prompt).toBeGreaterThanOrEqual(10);
  });
});
