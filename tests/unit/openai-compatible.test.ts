import { describe, expect, it, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { OpenAICompatibleProvider } from '@/lib/llm/openai-compatible';
import { resetConfig } from '@/lib/config/env';
import type { UsageRecord } from '@/lib/llm/provider';

resetConfig();

const base = {
  name: 'TestProvider',
  baseUrl: 'https://api.test/v1',
  apiKey: 'test-key',
  modelFast: 'test/fast',
  modelMain: 'test/main',
  structuredOutput: 'json_object' as const,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

afterEach(() => vi.restoreAllMocks());

describe('Spec 06 / ADR-012 — OpenAI-kompatibler Provider', () => {
  it('sendet Chat-Completions und erfasst Verbrauch', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: 'Hallo Welt' } }],
        usage: { prompt_tokens: 12, completion_tokens: 3 },
      }),
    );
    const usage: UsageRecord[] = [];
    const provider = new OpenAICompatibleProvider(base, (u) => usage.push(u));

    const result = await provider.generateText({
      system: 'sys', input: [{ role: 'user', text: 'hi' }], purpose: 'conversation', model: 'main',
    });

    expect(result.text).toBe('Hallo Welt');
    expect(result.model).toBe('test/main');
    expect(usage[0]).toMatchObject({ inputTokens: 12, outputTokens: 3, kind: 'conversation' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/v1/chat/completions');
    const body = JSON.parse(init.body as string) as { model: string; messages: { role: string }[] };
    expect(body.model).toBe('test/main');
    expect(body.messages.map((m) => m.role)).toEqual(['system', 'user']);
  });

  it('streamt Deltas aus dem SSE-Format', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Teil "}}]}\n',
        'data: {"choices":[{"delta":{"content":"zwei"}}]}\n',
        'data: [DONE]\n',
      ]),
    );
    const provider = new OpenAICompatibleProvider(base);
    let text = '';
    for await (const delta of provider.streamText({
      system: 'sys', input: [{ role: 'user', text: 'hi' }], purpose: 'synthesis',
    })) {
      text += delta;
    }
    expect(text).toBe('Teil zwei');
  });

  it('parst Structured Output auch aus einem Markdown-Codeblock', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: '```json\n{"taskType":"deep_research"}\n```' } }] }),
    );
    const provider = new OpenAICompatibleProvider(base);
    const schema = z.object({ taskType: z.string() });
    const result = await provider.generateObject({
      system: 'sys', input: [{ role: 'user', text: 'x' }], purpose: 'router',
      schema, schemaName: 'router',
    });
    expect(result.taskType).toBe('deep_research');
  });

  it('wiederholt bei Schemaverletzung genau einmal', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: '{"falsch":1}' } }] }))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: '{"wert":"ok"}' } }] }));
    const provider = new OpenAICompatibleProvider(base);
    const result = await provider.generateObject({
      system: 'sys', input: [{ role: 'user', text: 'x' }], purpose: 'plan',
      schema: z.object({ wert: z.string() }), schemaName: 'plan',
    });
    expect(result.wert).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('meldet 401 als klaren Konfigurationsfehler', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ error: { message: 'invalid key' } }, 401),
    );
    const provider = new OpenAICompatibleProvider(base);
    await expect(
      provider.generateText({ system: 's', input: [{ role: 'user', text: 'x' }], purpose: 'router' }),
    ).rejects.toMatchObject({
      appError: { code: 'LLM_UNAVAILABLE', retryable: false },
    });
  });

  it('meldet erschöpftes Kontingent verständlich', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ error: { message: 'You have no credits remaining', code: 'insufficient_quota' } }, 429),
    );
    const provider = new OpenAICompatibleProvider(base);
    await expect(
      provider.generateText({ system: 's', input: [{ role: 'user', text: 'x' }], purpose: 'router' }),
    ).rejects.toMatchObject({
      appError: { retryable: false, userMessage: expect.stringContaining('Kontingent') },
    });
  });

  it('bricht bei abgebrochenem Signal ab', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const provider = new OpenAICompatibleProvider(base);
    await expect(
      provider.generateText({
        system: 's', input: [{ role: 'user', text: 'x' }], purpose: 'router', signal: controller.signal,
      }),
    ).rejects.toMatchObject({ appError: { code: 'RUN_CANCELLED' } });
  });
});
