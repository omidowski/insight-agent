import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { GET as healthGet } from '@/app/api/health/route';
import { GET as listConversations, POST as createConversation } from '@/app/api/conversations/route';
import { GET as getConversation, PATCH as patchConversation, DELETE as deleteConversation } from '@/app/api/conversations/[id]/route';
import { POST as createRun } from '@/app/api/runs/route';
import { GET as getRun } from '@/app/api/runs/[id]/route';
import { POST as cancelRun } from '@/app/api/runs/[id]/cancel/route';
import { getRepositories } from '@/lib/db/repositories';
import { startFixtureServer, type FixtureServer } from '../helpers/fixture-server';

// Die Route-Handler leiten den Origin aus der Request-URL ab; der Fixture-Server liefert
// darunter die Demo-Quellen aus, sodass der echte Abrufpfad geprüft wird.
let server: FixtureServer;
let BASE = 'http://127.0.0.1:3000';

function post(path: string, body: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function waitForRun(runId: string, timeoutMs = 15000): Promise<void> {
  const repos = getRepositories();
  const started = Date.now();
  for (;;) {
    const run = repos.runs.get(runId);
    if (run && ['completed', 'failed', 'cancelled'].includes(run.status)) return;
    if (Date.now() - started > timeoutMs) throw new Error(`Run ${runId} wurde nicht fertig`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

beforeAll(async () => {
  server = await startFixtureServer();
  BASE = server.origin;
  getRepositories().users.ensureLocal();
});

afterAll(async () => {
  await server.close();
});

describe('Spec 08/11 — API', () => {
  it('Health meldet Anbieter, Modell und DB-Status', async () => {
    const response = await healthGet();
    const body = (await response.json()) as {
      ok: boolean; configured: boolean; provider: string; model: string | null;
      searchConfigured: boolean; dbOk: boolean;
    };
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.configured).toBe(true);
    expect(body.provider).toBe('compatible');
    expect(body.model).toBe('stub/main');
    expect(body.searchConfigured).toBe(true);
    expect(body.dbOk).toBe(true);
  });

  it('AC-08-01: ungültiger Body liefert 400 mit VALIDATION_FAILED', async () => {
    const response = await createRun(post('/api/runs', { message: '' }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });

  it('AC-08-02: POST /api/runs antwortet sofort mit 202 und runId', async () => {
    const started = Date.now();
    const response = await createRun(post('/api/runs', { message: 'Hallo', mode: 'chat' }));
    const elapsed = Date.now() - started;
    expect(response.status).toBe(202);
    expect(elapsed).toBeLessThan(1500);
    const body = (await response.json()) as { runId: string; conversationId: string };
    expect(body.runId).toMatch(/^run_/);
    await waitForRun(body.runId);
  }, 20000);

  it('AC-11-01 / AC-11-02: Conversation entsteht implizit und erhält einen Titel', async () => {
    const response = await createRun(post('/api/runs', { message: 'Was ist ein Vektor-Embedding?', mode: 'chat' }));
    const { runId, conversationId } = (await response.json()) as { runId: string; conversationId: string };
    await waitForRun(runId);

    const detail = await getConversation(new Request(`${BASE}/api/conversations/${conversationId}`), {
      params: Promise.resolve({ id: conversationId }),
    });
    const body = (await detail.json()) as {
      conversation: { title: string };
      messages: { role: string; content: string; citations: unknown[] }[];
    };
    expect(body.conversation.title).not.toBe('Neuer Chat');
    expect(body.conversation.title.length).toBeLessThanOrEqual(60);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1]!.role).toBe('assistant');
    expect(body.messages[1]!.content.length).toBeGreaterThan(5);
  }, 20000);

  it('AC-08-03: Abbruch eines beendeten Runs liefert 409', async () => {
    const response = await createRun(post('/api/runs', { message: 'Hallo', mode: 'chat' }));
    const { runId } = (await response.json()) as { runId: string };
    await waitForRun(runId);
    const cancel = await cancelRun(post(`/api/runs/${runId}/cancel`, {}), {
      params: Promise.resolve({ id: runId }),
    });
    expect(cancel.status).toBe(409);
  }, 20000);

  it('GET /api/runs/:id liefert die vollständige Rekonstruktion (AC-40-03)', async () => {
    const response = await createRun(post('/api/runs', { message: 'Recherchiere Statistiken zu Jamal Musiala.' }));
    const { runId } = (await response.json()) as { runId: string };
    await waitForRun(runId, 30000);
    const detail = await getRun(new Request(`${BASE}/api/runs/${runId}`), { params: Promise.resolve({ id: runId }) });
    const body = (await detail.json()) as {
      run: { status: string }; steps: unknown[]; sources: unknown[];
      toolCalls: unknown[]; citations: unknown[]; usage: unknown[];
    };
    expect(body.run.status).toBe('completed');
    expect(body.steps.length).toBeGreaterThan(0);
    expect(body.sources.length).toBeGreaterThan(0);
    expect(body.toolCalls.length).toBeGreaterThan(0);
    expect(body.citations.length).toBeGreaterThan(0);
  }, 40000);

  it('AC-08-04 / AC-11-04: Löschen entfernt die Conversation dauerhaft', async () => {
    const created = await createConversation(post('/api/conversations', { title: 'Temporär' }));
    expect(created.status).toBe(201);
    const { conversation } = (await created.json()) as { conversation: { id: string } };

    const renamed = await patchConversation(post(`/api/conversations/${conversation.id}`, { title: 'Neuer Name' }), {
      params: Promise.resolve({ id: conversation.id }),
    });
    expect(renamed.status).toBe(200);

    const removed = await deleteConversation(new Request(`${BASE}/api/conversations/${conversation.id}`, { method: 'DELETE' }), {
      params: Promise.resolve({ id: conversation.id }),
    });
    expect(removed.status).toBe(204);

    const after = await getConversation(new Request(`${BASE}/api/conversations/${conversation.id}`), {
      params: Promise.resolve({ id: conversation.id }),
    });
    expect(after.status).toBe(404);
  });

  it('AC-11-03: Liste ist nach Aktualität sortiert', async () => {
    const list = await listConversations(new Request(`${BASE}/api/conversations`));
    const body = (await list.json()) as { conversations: { updatedAt: string }[] };
    const dates = body.conversations.map((c) => c.updatedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

});
