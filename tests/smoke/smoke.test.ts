/**
 * Smoke-Test (Spec 42, FR-42-04): startet den Produktionsbuild und prüft den vollständigen
 * Ablauf über HTTP/SSE. Modell und Suche laufen gegen den lokalen Stub-Server — die Anwendung
 * verwendet dabei ihren echten Provider-Code (ADR-014).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import { rmSync } from 'node:fs';
import { startStubServer, type StubServer } from '../doubles/stub-server';

const DB_PATH = './data/smoke.db';
let stub: StubServer;
let server: ChildProcess;
let base = '';

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 3000;
      probe.close(() => resolve(port));
    });
  });
}

async function waitForHealth(timeoutMs = 90_000): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return (await response.json()) as Record<string, unknown>;
    } catch {
      /* Server startet noch */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Server wurde nicht bereit');
}

interface TraceEvent { type: string; payload: Record<string, unknown> }

async function readEvents(runId: string, maxMs = 90_000): Promise<TraceEvent[]> {
  const response = await fetch(`${base}/api/runs/${runId}/events?after=0`, {
    headers: { Accept: 'text/event-stream' },
  });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const events: TraceEvent[] = [];
  let buffer = '';
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const type = /event: (\S+)/.exec(block)?.[1];
      const data = /data: (.+)/.exec(block)?.[1];
      if (!type || !data) continue;
      events.push({ type, payload: (JSON.parse(data) as { payload: Record<string, unknown> }).payload });
      if (['run.completed', 'run.failed', 'run.cancelled'].includes(type)) {
        await reader.cancel().catch(() => undefined);
        return events;
      }
    }
  }
  await reader.cancel().catch(() => undefined);
  return events;
}

async function createRun(body: Record<string, unknown>): Promise<{ runId: string; conversationId: string }> {
  const response = await fetch(`${base}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(202);
  return (await response.json()) as { runId: string; conversationId: string };
}

beforeAll(async () => {
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${DB_PATH}${suffix}`, { force: true });
  stub = await startStubServer();
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;

  server = spawn('npx', ['next', 'start', '-p', String(port), '-H', '127.0.0.1'], {
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: DB_PATH,
      LOG_LEVEL: 'error',
      LLM_PROVIDER: 'compatible',
      LLM_BASE_URL: stub.baseUrlV1,
      LLM_API_KEY: 'stub-key',
      LLM_MODEL_FAST: 'stub/fast',
      LLM_MODEL_MAIN: 'stub/main',
      SEARCH_PROVIDER: 'tavily',
      TAVILY_API_KEY: 'stub-key',
      TAVILY_BASE_URL: stub.origin,
      ALLOW_LOOPBACK_FETCH: '1',
      RESPECT_ROBOTS: 'false',
      DOMAIN_RATE_LIMIT_MS: '0',
      RATE_LIMIT_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForHealth();
}, 120_000);

afterAll(async () => {
  server?.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 300));
  server?.kill('SIGKILL');
  await stub?.close();
});

describe('Smoke — Produktionsbuild über HTTP', () => {
  it('Health meldet konfigurierten Anbieter, Modell und Suche', async () => {
    const health = await waitForHealth();
    expect(health.ok).toBe(true);
    expect(health.configured).toBe(true);
    expect(health.provider).toBe('compatible');
    expect(health.searchConfigured).toBe(true);
  });

  it('Startseite lädt', async () => {
    const page = await fetch(`${base}/`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('Insight Agent');
  });

  it('bietet Modelle zur Auswahl an', async () => {
    const response = await fetch(`${base}/api/models`);
    const body = (await response.json()) as { models: { id: string }[]; currentMain: string };
    expect(body.models.length).toBeGreaterThanOrEqual(4);
    expect(body.models.map((m) => m.id)).toContain('meta/llama-3.3-70b-instruct');
    expect(body.currentMain).toBe('stub/main');
  });

  it('Chat-Run läuft ohne Werkzeugaufrufe durch', async () => {
    const { runId } = await createRun({ message: 'Hallo' });
    const events = await readEvents(runId);
    expect(events.some((e) => e.type === 'run.completed')).toBe(true);
    expect(events.some((e) => e.type.startsWith('tool.call'))).toBe(false);
  }, 60_000);

  it('Research-Run liefert Trace, Quellen und Citations', async () => {
    const { runId } = await createRun({
      message: 'Recherchiere aktuelle Statistiken über den Fußballspieler Jamal Musiala.',
    });
    const events = await readEvents(runId);
    const types = new Set(events.map((e) => e.type));
    for (const expected of ['plan.created', 'search.results', 'source.opened', 'source.extracted', 'run.completed']) {
      expect(types.has(expected), `Event ${expected} fehlt`).toBe(true);
    }

    const detail = (await (await fetch(`${base}/api/runs/${runId}`)).json()) as {
      run: { status: string };
      sources: { id: string; status: string }[];
      citations: { sourceId: string }[];
      message: { content: string } | null;
    };
    expect(detail.run.status).toBe('completed');
    expect(detail.sources.filter((s) => s.status === 'fetched').length).toBeGreaterThanOrEqual(3);
    expect(detail.citations.length).toBeGreaterThanOrEqual(1);
    expect(detail.message?.content).toMatch(/\[\d+\]/);
    expect(detail.message?.content).toContain('## Quellen');

    const knownIds = new Set(detail.sources.map((s) => s.id));
    for (const citation of detail.citations) expect(knownIds.has(citation.sourceId)).toBe(true);
  }, 90_000);

  it('gewähltes Modell wird für den Run verwendet', async () => {
    const before = stub.requests.filter((r) => r.model === 'meta/llama-3.3-70b-instruct').length;
    const { runId } = await createRun({ message: 'Hallo', model: 'meta/llama-3.3-70b-instruct' });
    await readEvents(runId);
    const after = stub.requests.filter((r) => r.model === 'meta/llama-3.3-70b-instruct').length;
    expect(after).toBeGreaterThan(before);
  }, 60_000);

  it('Follow-up nutzt vorhandene Quellen ohne neue Suche', async () => {
    const first = await createRun({
      message: 'Recherchiere aktuelle Statistiken über den Fußballspieler Jamal Musiala.',
    });
    await readEvents(first.runId);
    const followUp = await createRun({
      message: 'Fasse das bitte kürzer zusammen.',
      conversationId: first.conversationId,
    });
    const events = await readEvents(followUp.runId);
    expect(events.some((e) => e.type === 'run.completed')).toBe(true);
    expect(events.some((e) => e.type === 'search.results')).toBe(false);
  }, 120_000);

  it('Abbruch beendet den Run zeitnah', async () => {
    const { runId } = await createRun({
      message: 'Recherchiere den Umsatz europäischer Fußballvereine.',
      mode: 'research',
    });
    await new Promise((r) => setTimeout(r, 300));
    const cancel = await fetch(`${base}/api/runs/${runId}/cancel`, { method: 'POST' });
    expect([200, 409]).toContain(cancel.status);

    const deadline = Date.now() + 20_000;
    let status = '';
    while (Date.now() < deadline) {
      const detail = (await (await fetch(`${base}/api/runs/${runId}`)).json()) as { run: { status: string } };
      status = detail.run.status;
      if (['cancelled', 'completed', 'failed'].includes(status)) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(['cancelled', 'completed']).toContain(status);
  }, 60_000);
});
