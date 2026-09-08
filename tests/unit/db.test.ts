import { describe, expect, it } from 'vitest';
import { openDatabase, migrate } from '@/lib/db/client';
import { createRepositories, LOCAL_USER_ID } from '@/lib/db/repositories';
import { freshRepos } from '../helpers/db';

describe('Spec 04 — Data Model & Database', () => {
  it('AC-04-01: Migrationen sind idempotent', () => {
    const db = openDatabase(':memory:');
    const second = migrate(db);
    expect(second).toEqual([]);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name);
    for (const t of ['conversations', 'messages', 'runs', 'run_events', 'sources', 'excerpts', 'citations', 'conflicts', 'usage_events', 'tool_calls', 'run_steps']) {
      expect(tables).toContain(t);
    }
  });

  it('AC-04-02: 100 Events erhalten lückenlose seq-Werte', () => {
    const repos = freshRepos();
    const conv = repos.conversations.create(LOCAL_USER_ID);
    const msg = repos.messages.create(conv.id, 'user', 'hi', 'complete');
    const run = repos.runs.create({
      conversationId: conv.id, userId: LOCAL_USER_ID, requestMessageId: msg.id,
      taskType: 'deep_research',
      budgets: { maxIterations: 1, maxSearches: 1, maxSources: 1, maxWallClockMs: 1000, maxInputTokens: 10, maxCostMicroUsd: 10, maxToolCalls: 1 },
    });
    for (let i = 0; i < 100; i++) {
      repos.events.append(run.id, conv.id, 'status.changed', { from: 'idle', to: 'routing' });
    }
    const events = repos.events.listByRun(run.id, 0, 1000);
    expect(events).toHaveLength(100);
    expect(events.map((e) => e.seq)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  });

  it('AC-04-03: Löschen einer Conversation entfernt abhängige Zeilen', () => {
    const repos = freshRepos();
    const conv = repos.conversations.create(LOCAL_USER_ID);
    const msg = repos.messages.create(conv.id, 'user', 'hi', 'complete');
    const run = repos.runs.create({
      conversationId: conv.id, userId: LOCAL_USER_ID, requestMessageId: msg.id,
      taskType: 'deep_research',
      budgets: { maxIterations: 1, maxSearches: 1, maxSources: 1, maxWallClockMs: 1000, maxInputTokens: 10, maxCostMicroUsd: 10, maxToolCalls: 1 },
    });
    repos.events.append(run.id, conv.id, 'run.started', { userRequestPreview: 'hi', mode: 'auto' });
    const src = repos.sources.upsert({
      runId: run.id, conversationId: conv.id, url: 'https://a.test/x', canonicalUrl: 'https://a.test/x',
      domain: 'a.test', title: 'X', sourceType: 'secondary', trustScore: 0.5, status: 'fetched',
    });
    repos.excerpts.create({ sourceId: src.id, runId: run.id, text: 'abc', startOffset: 0, endOffset: 3 });
    expect(repos.conversations.remove(conv.id, LOCAL_USER_ID)).toBe(true);
    expect(repos.runs.get(run.id)).toBeUndefined();
    expect(repos.events.count(run.id)).toBe(0);
    expect(repos.sources.listByRun(run.id)).toHaveLength(0);
    expect(repos.excerpts.listByRun(run.id)).toHaveLength(0);
  });

  it('AC-04-04: identische URL wird im Run dedupliziert', () => {
    const repos = freshRepos();
    const conv = repos.conversations.create(LOCAL_USER_ID);
    const msg = repos.messages.create(conv.id, 'user', 'hi', 'complete');
    const run = repos.runs.create({
      conversationId: conv.id, userId: LOCAL_USER_ID, requestMessageId: msg.id, taskType: 'deep_research',
      budgets: { maxIterations: 1, maxSearches: 1, maxSources: 1, maxWallClockMs: 1000, maxInputTokens: 10, maxCostMicroUsd: 10, maxToolCalls: 1 },
    });
    const a = repos.sources.upsert({ runId: run.id, conversationId: conv.id, url: 'https://a.test/x', canonicalUrl: 'https://a.test/x', domain: 'a.test', title: 'X', sourceType: 'secondary', trustScore: 0.5, status: 'discovered' });
    const b = repos.sources.upsert({ runId: run.id, conversationId: conv.id, url: 'https://a.test/x?utm_source=y', canonicalUrl: 'https://a.test/x', domain: 'a.test', title: 'X2', sourceType: 'secondary', trustScore: 0.5, status: 'discovered' });
    expect(b.id).toBe(a.id);
    expect(repos.sources.listByRun(run.id)).toHaveLength(1);
    expect(a.indexNum).toBe(1);
  });

  it('Konversationsliste ist nach updated_at absteigend sortiert (AC-11-03)', () => {
    const repos = freshRepos();
    const older = repos.conversations.create(LOCAL_USER_ID, 'alt');
    const newer = repos.conversations.create(LOCAL_USER_ID, 'neu');
    repos.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run('2020-01-01T00:00:00.000Z', older.id);
    const list = repos.conversations.listByUser(LOCAL_USER_ID);
    expect(list[0]?.id).toBe(newer.id);
  });
});
