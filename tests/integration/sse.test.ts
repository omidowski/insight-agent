import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { GET as eventsGet } from '@/app/api/runs/[id]/events/route';
import { POST as createRun } from '@/app/api/runs/route';
import { getRepositories, LOCAL_USER_ID } from '@/lib/db/repositories';
import { startFixtureServer, type FixtureServer } from '../helpers/fixture-server';
import { budgetsFor } from '@/lib/agent/paths';
import { getConfig } from '@/lib/config/env';

let server: FixtureServer;
let BASE = '';

beforeAll(async () => {
  server = await startFixtureServer();
  BASE = server.origin;
});
afterAll(async () => {
  await server.close();
});

function seededRun() {
  const repos = getRepositories();
  repos.users.ensureLocal();
  const conversation = repos.conversations.create(LOCAL_USER_ID);
  const message = repos.messages.create(conversation.id, 'user', 'test', 'complete');
  const run = repos.runs.create({
    conversationId: conversation.id, userId: LOCAL_USER_ID, requestMessageId: message.id,
    taskType: 'deep_research', budgets: budgetsFor('deep_research', getConfig()),
  });
  return { repos, run, conversation };
}

async function readStream(response: Response, maxMs = 5000): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  const deadline = Date.now() + maxMs;
  for (;;) {
    if (Date.now() > deadline) break;
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

function parseEvents(raw: string): { id: number; type: string }[] {
  return raw
    .split('\n\n')
    .filter((block) => block.includes('event:'))
    .map((block) => ({
      id: Number(/id: (\d+)/.exec(block)?.[1] ?? 0),
      type: /event: (\S+)/.exec(block)?.[1] ?? '',
    }));
}

describe('Spec 09 — Streaming-Protokoll', () => {
  it('AC-09-02 / AC-09-03: beendeter Run liefert alle Events lückenlos und schließt', async () => {
    const { repos, run, conversation } = seededRun();
    for (let i = 0; i < 5; i++) {
      repos.events.append(run.id, conversation.id, 'status.changed', { from: 'idle', to: 'routing' });
    }
    repos.events.append(run.id, conversation.id, 'run.completed', {
      messageId: 'msg_1', sourceCount: 0, citationCount: 0, durationMs: 1, costMicroUsd: 0, stopReason: 'answered',
    });

    const response = await eventsGet(new Request(`${BASE}/api/runs/${run.id}/events`), {
      params: Promise.resolve({ id: run.id }),
    });
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    const events = parseEvents(await readStream(response));
    expect(events).toHaveLength(6);
    expect(events.map((e) => e.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(events[5]!.type).toBe('run.completed');
  }, 15000);

  it('AC-09-01: Stream beginnt nach ?after= beim nächsten seq', async () => {
    const { repos, run, conversation } = seededRun();
    for (let i = 0; i < 8; i++) {
      repos.events.append(run.id, conversation.id, 'status.changed', { from: 'idle', to: 'routing' });
    }
    repos.events.append(run.id, conversation.id, 'run.cancelled', { atStatus: 'routing' });

    const response = await eventsGet(new Request(`${BASE}/api/runs/${run.id}/events?after=5`), {
      params: Promise.resolve({ id: run.id }),
    });
    const events = parseEvents(await readStream(response));
    expect(events[0]!.id).toBe(6);
    expect(events.at(-1)!.type).toBe('run.cancelled');
  }, 15000);

  it('Last-Event-ID wird berücksichtigt', async () => {
    const { repos, run, conversation } = seededRun();
    for (let i = 0; i < 3; i++) {
      repos.events.append(run.id, conversation.id, 'status.changed', { from: 'idle', to: 'routing' });
    }
    repos.events.append(run.id, conversation.id, 'run.failed', { code: 'INTERNAL', userMessage: 'x' });
    const response = await eventsGet(
      new Request(`${BASE}/api/runs/${run.id}/events`, { headers: { 'last-event-id': '3' } }),
      { params: Promise.resolve({ id: run.id }) },
    );
    const events = parseEvents(await readStream(response));
    expect(events).toHaveLength(1);
    expect(events[0]!.id).toBe(4);
  }, 15000);

  it('unbekannter Run liefert 404', async () => {
    const response = await eventsGet(new Request(`${BASE}/api/runs/run_unbekannt/events`), {
      params: Promise.resolve({ id: 'run_unbekannt' }),
    });
    expect(response.status).toBe(404);
  });

  it('AC-09-05: Secrets werden nicht ausgeliefert', async () => {
    const { repos, run, conversation } = seededRun();
    repos.events.append(run.id, conversation.id, 'tool.call.failed', {
      toolCallId: 'tcl_1', tool: 'web_search', code: 'SEARCH_FAILED', message: 'Key sk-live-123456 ungültig',
    });
    repos.events.append(run.id, conversation.id, 'run.cancelled', { atStatus: 'routing' });
    const response = await eventsGet(new Request(`${BASE}/api/runs/${run.id}/events`), {
      params: Promise.resolve({ id: run.id }),
    });
    const raw = await readStream(response);
    expect(raw).not.toContain('sk-live-123456');
  }, 15000);

  it('AC-09-04: Abbruch des Streams beendet den Run nicht', async () => {
    const response = await createRun(
      new Request(`${BASE}/api/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hallo', mode: 'chat' }),
      }),
    );
    const { runId } = (await response.json()) as { runId: string };

    const controller = new AbortController();
    const stream = await eventsGet(
      new Request(`${BASE}/api/runs/${runId}/events`, { signal: controller.signal }),
      { params: Promise.resolve({ id: runId }) },
    );
    const reader = stream.body!.getReader();
    await reader.read();
    controller.abort();
    await reader.cancel().catch(() => undefined);

    const repos = getRepositories();
    const started = Date.now();
    for (;;) {
      const run = repos.runs.get(runId)!;
      if (run.status === 'completed') break;
      if (Date.now() - started > 15000) throw new Error(`Run endete als ${run.status}`);
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(repos.runs.get(runId)!.status).toBe('completed');
  }, 25000);
});
