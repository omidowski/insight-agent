import { describe, expect, it, beforeEach } from 'vitest';
import { topoSort, hasCycle } from '@/lib/util/graph';
import { checkRateLimit, resetRateLimits, withDomainLimit, acquireSlot } from '@/lib/util/rate-limit';
import { mapLimit, Semaphore } from '@/lib/util/concurrency';
import { estimateTokens, truncateToTokens, relevantExcerptText } from '@/lib/util/tokens';

describe('Spec 15 — Plangraph', () => {
  it('AC-15-02: Zyklen werden aufgelöst', () => {
    const nodes = [
      { id: 'a', dependsOn: ['b'] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: [] },
    ];
    const result = topoSort(nodes);
    expect(result.ordered).toHaveLength(3);
    expect(result.removedEdges.length).toBeGreaterThan(0);
    expect(hasCycle([{ id: 'a', dependsOn: [] }])).toBe(false);
  });

  it('sortiert topologisch', () => {
    const result = topoSort([
      { id: 'c', dependsOn: ['a', 'b'] },
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
    ]);
    expect(result.ordered.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('Spec 36 — Rate Limiting', () => {
  beforeEach(() => resetRateLimits());

  it('AC-36-01: über dem Limit wird abgelehnt', () => {
    for (let i = 0; i < 3; i++) expect(checkRateLimit('u:runs', 3, 3600_000).allowed).toBe(true);
    const denied = checkRateLimit('u:runs', 3, 3600_000);
    expect(denied.allowed).toBe(false);
    expect(denied.resetInSeconds).toBeGreaterThan(0);
  });

  it('AC-36-02: Domain-Zugriffe werden serialisiert', async () => {
    const started: number[] = [];
    await Promise.all([
      withDomainLimit('a.example', 60, async () => { started.push(Date.now()); }),
      withDomainLimit('a.example', 60, async () => { started.push(Date.now()); }),
    ]);
    expect(started).toHaveLength(2);
    expect((started[1] as number) - (started[0] as number)).toBeGreaterThanOrEqual(55);
  });

  it('begrenzt gleichzeitige Runs', () => {
    const first = acquireSlot('u', 1);
    expect(first).toBeDefined();
    expect(acquireSlot('u', 1)).toBeUndefined();
    first?.();
    expect(acquireSlot('u', 1)).toBeDefined();
  });
});

describe('Spec 16/33 — Nebenläufigkeit und Kontext', () => {
  it('AC-16-01: Parallelität wird begrenzt', async () => {
    const semaphore = new Semaphore(2);
    let peak = 0;
    let active = 0;
    await mapLimit([1, 2, 3, 4, 5], 2, async () => {
      const release = await semaphore.acquire();
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      release();
    });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('AC-33-01: Kürzung respektiert das Tokenbudget', () => {
    const long = 'Satz eins. '.repeat(500);
    const { text, truncated } = truncateToTokens(long, 100);
    expect(truncated).toBe(true);
    expect(estimateTokens(text)).toBeLessThan(140);
  });

  it('AC-33-04: relevante Absätze bleiben erhalten', () => {
    const text = ['Unwichtiger Absatz über Wetter.', 'Der Umsatz betrug 765 Mio. Euro im Geschäftsjahr.', 'Noch ein unwichtiger Absatz.'].join('\n\n');
    const result = relevantExcerptText(text, 'Wie hoch war der Umsatz?', 60);
    expect(result).toContain('Umsatz');
  });
});
