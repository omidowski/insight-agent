import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { executeTool, executeToolDefinition, getToolsFor, toolResultForModel } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';
import { freshRepos } from '../helpers/db';
import { createEmitter } from '@/lib/agent/events';
import { LOCAL_USER_ID } from '@/lib/db/repositories';
import { getConfig, resetConfig } from '@/lib/config/env';
import { logger } from '@/lib/util/logger';
import { budgetsFor } from '@/lib/agent/paths';
import { fakeSearch } from '../helpers/providers';

resetConfig();

function setup(signal?: AbortSignal) {
  const repos = freshRepos();
  const config = getConfig();
  const conversation = repos.conversations.create(LOCAL_USER_ID);
  const message = repos.messages.create(conversation.id, 'user', 'x', 'complete');
  const run = repos.runs.create({
    conversationId: conversation.id, userId: LOCAL_USER_ID, requestMessageId: message.id,
    taskType: 'deep_research', budgets: budgetsFor('deep_research', config),
  });
  const emitter = createEmitter(repos, run.id, conversation.id);
  const ctx: ToolContext = {
    runId: run.id, conversationId: conversation.id, stepId: null,
    signal: signal ?? new AbortController().signal,
    emitter, repos, config, logger,
    search: fakeSearch('http://127.0.0.1:1'),
    cache: new Map(), consume: () => undefined,
  };
  return { ctx, repos, run };
}

describe('Spec 18 — Tool-Executor', () => {
  it('AC-18-01: ungültige Parameter erzeugen ein Fehlerergebnis statt einer Ausnahme', async () => {
    const { ctx } = setup();
    const outcome = await executeTool('calculator', { expression: 42 }, ctx, ['calculator']);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('VALIDATION_FAILED');
  });

  it('AC-18-04: nicht erlaubte Werkzeuge werden nicht ausgeführt', async () => {
    const { ctx, repos, run } = setup();
    const outcome = await executeTool('web_search', { query: 'test' }, ctx, ['calculator']);
    expect(outcome.ok).toBe(false);
    expect(repos.toolCalls.listByRun(run.id)).toHaveLength(0);
  });

  it('AC-18-05: identische Aufrufe werden aus dem Cache bedient', async () => {
    const { ctx, repos, run } = setup();
    await executeTool('calculator', { expression: '2+2' }, ctx, ['calculator']);
    await executeTool('calculator', { expression: '2+2' }, ctx, ['calculator']);
    expect(repos.toolCalls.listByRun(run.id)).toHaveLength(1);
  });

  it('protokolliert erfolgreiche Aufrufe mit Events', async () => {
    const { ctx, repos, run } = setup();
    const outcome = await executeTool('calculator', { expression: '(1200+300)*0.19' }, ctx, ['calculator']);
    expect(outcome.ok).toBe(true);
    const events = repos.events.listByRun(run.id).map((e) => e.type);
    expect(events).toContain('tool.call.started');
    expect(events).toContain('tool.call.completed');
    const calls = repos.toolCalls.listByRun(run.id);
    expect(calls[0]!.status).toBe('completed');
    expect(calls[0]!.durationMs).not.toBeNull();
  });

  it('AC-18-02: abgebrochene Signale beenden den Aufruf', async () => {
    const controller = new AbortController();
    controller.abort();
    const { ctx } = setup(controller.signal);
    const outcome = await executeTool('open_url', { url: 'https://example.com' }, ctx, ['open_url']);
    expect(outcome.ok).toBe(false);
  });

  it('AC-18-03: Ergebnisse werden für das Modell gekürzt', () => {
    const text = toolResultForModel('web_search', {
      ok: true,
      result: { results: Array.from({ length: 200 }, () => ({ snippet: 'x'.repeat(200) })) },
    });
    expect(text).toContain('gekürzt');
  });

  it('Allowlist filtert die Registry', () => {
    expect(getToolsFor(['calculator']).map((t) => t.name)).toEqual(['calculator']);
    expect(getToolsFor([])).toHaveLength(0);
  });

  it('AC-18-02: Timeout beendet den Aufruf mit TOOL_TIMEOUT', async () => {
    const { ctx, repos, run } = setup();
    const slowTool = {
      name: 'calculator' as const,
      description: 'langsam',
      parameters: z.object({}),
      result: z.object({ ok: z.boolean() }),
      timeoutMs: 60,
      maxRetries: 0,
      costClass: 'free' as const,
      resultTokenBudget: 10,
      cacheable: false,
      execute: () => new Promise<{ ok: boolean }>(() => undefined),
      summarize: () => 'nie',
    };
    const started = Date.now();
    const outcome = await executeToolDefinition(slowTool as never, {}, ctx);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('TOOL_TIMEOUT');
    expect(Date.now() - started).toBeLessThan(1000);
    const calls = repos.toolCalls.listByRun(run.id);
    expect(calls[0]!.status).toBe('failed');
    expect(repos.events.listByRun(run.id).map((e) => e.type)).toContain('tool.call.failed');
  });
});
