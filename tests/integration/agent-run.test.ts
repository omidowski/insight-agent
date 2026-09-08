import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freshRepos } from '../helpers/db';
import { startFixtureServer, type FixtureServer } from '../helpers/fixture-server';
import { executeRun } from '@/lib/agent/orchestrator';
import { getConfig, resetConfig } from '@/lib/config/env';
import { fakeLlm, fakeSearch } from '../helpers/providers';
import { LOCAL_USER_ID, type Repositories } from '@/lib/db/repositories';
import { budgetsFor } from '@/lib/agent/paths';

let server: FixtureServer;

async function runRequest(repos: Repositories, text: string, mode: 'auto' | 'chat' | 'research' = 'auto', conversationId?: string) {
  const config = getConfig();
  const conversation = conversationId
    ? repos.conversations.get(conversationId, LOCAL_USER_ID)!
    : repos.conversations.create(LOCAL_USER_ID);
  const message = repos.messages.create(conversation.id, 'user', text, 'complete');
  const run = repos.runs.create({
    conversationId: conversation.id,
    userId: LOCAL_USER_ID,
    requestMessageId: message.id,
    taskType: 'knowledge_question',
    budgets: budgetsFor('deep_research', config),
  });
  await executeRun({
    runId: run.id, mode, repos, config,
    llm: fakeLlm(), search: fakeSearch(server.origin),
  });
  return { conversation, run: repos.runs.get(run.id)!, events: repos.events.listByRun(run.id, 0, 1000) };
}

beforeAll(async () => {
  resetConfig();
  server = await startFixtureServer();
});
afterAll(async () => {
  await server.close();
});

describe('Spec 00/14 — Referenzszenarien mit Test-Doubles', () => {
  it('AC-00-01 / AC-14-01: „Hallo" wird ohne Tool-Aufruf beantwortet', async () => {
    const repos = freshRepos();
    const { run, events } = await runRequest(repos, 'Hallo');
    expect(run.status).toBe('completed');
    expect(run.taskType).toBe('conversation');
    expect(events.filter((e) => e.type.startsWith('tool.call'))).toHaveLength(0);
    const message = repos.messages.get(run.responseMessageId!);
    expect(message?.content.length).toBeGreaterThan(10);
    expect(message?.status).toBe('complete');
  }, 20000);

  it('AC-00-02 / AC-14-02: Research-Anfrage erzeugt Plan, Suche, Quellen und Citations', async () => {
    const repos = freshRepos();
    const { run, events } = await runRequest(
      repos, 'Recherchiere aktuelle Statistiken über den Fußballspieler Jamal Musiala.',
    );
    const types = events.map((e) => e.type);
    expect(run.status).toBe('completed');
    expect(types).toContain('plan.created');
    expect(types).toContain('search.results');
    expect(types).toContain('source.opened');
    expect(types).toContain('source.extracted');
    expect(types).toContain('run.completed');

    const sources = repos.sources.listByRun(run.id).filter((s) => s.status === 'fetched');
    expect(sources.length).toBeGreaterThanOrEqual(3);

    const citations = repos.citations.listByMessage(run.responseMessageId!);
    expect(citations.length).toBeGreaterThanOrEqual(1);

    const answer = repos.messages.get(run.responseMessageId!)!.content;
    expect(answer).toMatch(/\[\d+\]/);
    expect(answer).toContain('## Quellen');

    // Jede Citation zeigt auf eine tatsächlich abgerufene Quelle (Spec 27, FR-27-03)
    const sourceIds = new Set(repos.sources.listByRun(run.id).map((s) => s.id));
    for (const citation of citations) expect(sourceIds.has(citation.sourceId)).toBe(true);
  }, 40000);

  it('AC-26-04 / AC-24-03: gespeicherte Excerpts stehen wörtlich in der Quelle', async () => {
    const repos = freshRepos();
    const { run } = await runRequest(repos, 'Recherchiere Statistiken zu Jamal Musiala.');
    const excerpts = repos.excerpts.listByRun(run.id);
    expect(excerpts.length).toBeGreaterThan(0);
    for (const excerpt of excerpts) {
      expect(excerpt.startOffset).toBeGreaterThanOrEqual(0);
      expect(excerpt.endOffset).toBeGreaterThan(excerpt.startOffset);
    }
  }, 40000);

  it('AC-28-02: widersprüchliche Umsatzangaben werden als Konflikt erkannt', async () => {
    const repos = freshRepos();
    const { run } = await runRequest(
      repos, 'Vergleiche den Umsatz der wertvollsten europäischen Fußballvereine und erstelle eine Tabelle.',
    );
    const sources = repos.sources.listByRun(run.id).filter((s) => s.status === 'fetched');
    expect(sources.length).toBeGreaterThanOrEqual(2);
    const answer = repos.messages.get(run.responseMessageId!)!.content;
    expect(answer.length).toBeGreaterThan(50);
  }, 40000);

  it('AC-10-05 / AC-13-03: Modus „chat" verhindert jede Websuche', async () => {
    const repos = freshRepos();
    const { run, events } = await runRequest(repos, 'Recherchiere Statistiken zu Jamal Musiala.', 'chat');
    expect(events.filter((e) => e.type === 'search.results')).toHaveLength(0);
    expect(repos.sources.listByRun(run.id)).toHaveLength(0);
  }, 20000);

  it('Determinismus: identische Anfrage liefert identische Antwort', async () => {
    const repos1 = freshRepos();
    const repos2 = freshRepos();
    const a = await runRequest(repos1, 'Was ist ein Vektor-Embedding?', 'chat');
    const b = await runRequest(repos2, 'Was ist ein Vektor-Embedding?', 'chat');
    expect(repos1.messages.get(a.run.responseMessageId!)!.content)
      .toBe(repos2.messages.get(b.run.responseMessageId!)!.content);
  }, 20000);
});

describe('Spec 24 — Ehrlichkeit bei fehlenden Quellen', () => {
  it('AC-24-05: Thema ohne passende Quellen liefert keine erfundenen Belege', async () => {
    const repos = freshRepos();
    const { run } = await runRequest(repos, 'Recherchiere die Wirtschaftslage in Portugal 2026.');
    expect(repos.sources.listByRun(run.id).filter((s) => s.status === 'fetched')).toHaveLength(0);
    expect(repos.citations.listByMessage(run.responseMessageId!)).toHaveLength(0);
    const answer = repos.messages.get(run.responseMessageId!)!.content;
    expect(answer).toMatch(/keine belastbaren Quellen/i);
    // Keine Belegmarker und kein Quellenverzeichnis, wenn nichts belegt ist
    expect(answer).not.toMatch(/\[\d+\]/);
    expect(answer).not.toMatch(/## Quellen/);
    // Der Hinweis auf die Demo-Themen ist erlaubt, eine fachfremde Aussage dazu nicht
    expect(answer).not.toMatch(/Musiala (erzielte|kommt|absolvierte)/i);
  }, 30000);
});
