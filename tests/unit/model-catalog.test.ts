import { afterEach, describe, expect, it, vi } from 'vitest';
import { getModelCatalog, clearModelCatalogCache } from '@/lib/llm/catalog';
import { withModel } from '@/lib/llm/with-model';
import { resetConfig } from '@/lib/config/env';
import type { LLMProvider, TextRequest } from '@/lib/llm/provider';

afterEach(() => {
  vi.restoreAllMocks();
  clearModelCatalogCache();
  resetConfig();
});

function modelsResponse(ids: string[]): Response {
  return new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Spec 48 — Modellauswahl', () => {
  it('AC-48-01: liefert Empfehlungen zuerst, danach alle übrigen alphabetisch', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      modelsResponse(['zzz/last', 'stub/fast', 'meta/llama-3.3-70b-instruct', 'aaa/first']),
    );
    const catalog = await getModelCatalog(true);
    expect(catalog.models.length).toBeGreaterThanOrEqual(4);
    const others = catalog.models.filter((m) => !m.recommended).map((m) => m.id);
    expect([...others].sort()).toEqual(others);
    expect(catalog.currentMain).toBe('stub/main');
  });

  it('AC-48-02: ungeeignete Modelle werden ausgefiltert', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      modelsResponse(['text-embedding-3-large', 'whisper-1', 'dall-e-3', 'chat/gut']),
    );
    const catalog = await getModelCatalog(true);
    const ids = catalog.models.map((m) => m.id);
    expect(ids).toContain('chat/gut');
    expect(ids).not.toContain('text-embedding-3-large');
    expect(ids).not.toContain('whisper-1');
    expect(ids).not.toContain('dall-e-3');
  });

  it('AC-48-03: ein Anbieterfehler beim Katalog bricht nichts ab', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    const catalog = await getModelCatalog(true);
    expect(Array.isArray(catalog.models)).toBe(true);
    expect(catalog.currentFast).toBe('stub/fast');
  });

  it('zwischenspeichert den Katalog', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(modelsResponse(['a/b']));
    await getModelCatalog(true);
    await getModelCatalog();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('AC-48-04: withModel überschreibt das Modell für jeden Aufruf', async () => {
    const seen: (string | undefined)[] = [];
    const base: LLMProvider = {
      name: 'spy',
      generateText: async (req: TextRequest) => {
        seen.push(req.modelName);
        return { text: 'x', model: req.modelName ?? 'default', inputTokens: 1, outputTokens: 1, estimated: true };
      },
      streamText: async function* (req: TextRequest) {
        seen.push(req.modelName);
        yield 'x';
      },
      generateObject: async (req) => {
        seen.push(req.modelName);
        return req.schema.parse({ wert: 'ok' });
      },
    };

    const wrapped = withModel(base, 'meta/llama-3.3-70b-instruct');
    await wrapped.generateText({ system: 's', input: [], purpose: 'p' });
    for await (const _ of wrapped.streamText({ system: 's', input: [], purpose: 'p' })) { /* verbrauchen */ }
    expect(seen).toEqual(['meta/llama-3.3-70b-instruct', 'meta/llama-3.3-70b-instruct']);

    const untouched = withModel(base, undefined);
    expect(untouched).toBe(base);
  });
});
