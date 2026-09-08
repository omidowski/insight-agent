import { describe, expect, it, vi } from 'vitest';
import { RunStateManager, canTransition, cancelRun, registerRun, unregisterRun } from '@/lib/agent/state';
import { freshRepos } from '../helpers/db';
import { createEmitter } from '@/lib/agent/events';
import { LOCAL_USER_ID } from '@/lib/db/repositories';
import type { RunBudgets } from '@/lib/contracts/domain';

const budgets: RunBudgets = {
  maxIterations: 2, maxSearches: 2, maxSources: 2, maxWallClockMs: 10_000,
  maxInputTokens: 1000, maxCostMicroUsd: 1000, maxToolCalls: 3,
};

function setup() {
  const repos = freshRepos();
  const conversation = repos.conversations.create(LOCAL_USER_ID);
  const message = repos.messages.create(conversation.id, 'user', 'test', 'complete');
  const run = repos.runs.create({
    conversationId: conversation.id, userId: LOCAL_USER_ID,
    requestMessageId: message.id, taskType: 'deep_research', budgets,
  });
  const emitter = createEmitter(repos, run.id, conversation.id);
  const state = new RunStateManager(run.id, conversation.id, { ...budgets }, repos, emitter);
  return { repos, run, state, conversationId: conversation.id };
}

describe('Spec 17/37 — Run-State und Budgets', () => {
  it('AC-17-01: unzulässige Übergänge werden abgelehnt', () => {
    const { state } = setup();
    state.setStatus('routing');
    state.setStatus('planning');
    state.setStatus('searching');
    state.setStatus('synthesizing');
    state.setStatus('completed');
    expect(() => state.setStatus('searching')).toThrow();
    expect(canTransition('completed', 'searching')).toBe(false);
    expect(canTransition('routing', 'planning')).toBe(true);
  });

  it('AC-17-02: Abbruch setzt das Signal und die Registry', () => {
    const { state } = setup();
    registerRun(state);
    expect(cancelRun(state.runId)).toBe(true);
    expect(state.signal.aborted).toBe(true);
    unregisterRun(state.runId);
    expect(cancelRun(state.runId)).toBe(false);
  });

  it('AC-17-04 / AC-37-01: Statuswechsel und Verbrauch werden persistiert', () => {
    const { state, repos, run } = setup();
    state.setStatus('routing');
    state.consume('search');
    state.addUsage({ inputTokens: 100, outputTokens: 20, costMicroUsd: 500 });
    const stored = repos.runs.get(run.id)!;
    expect(stored.status).toBe('routing');
    expect(stored.usage.searches).toBe(1);
    expect(stored.usage.costMicroUsd).toBe(500);
  });

  it('AC-37-02: Budgetwarnung erscheint genau einmal je Art', () => {
    const { state, repos, run } = setup();
    state.addUsage({ costMicroUsd: 900 });
    state.addUsage({ costMicroUsd: 50 });
    const warnings = repos.events.listByRun(run.id).filter((e) => e.type === 'budget.warning');
    expect(warnings.filter((w) => (w.payload as { kind: string }).kind === 'cost')).toHaveLength(1);
  });

  it('Budgetgrenzen werden hart durchgesetzt', () => {
    const { state } = setup();
    state.consume('search');
    state.consume('search');
    expect(() => state.consume('search')).toThrow(/Suchbudget/);
    expect(state.hasBudgetForResearch()).toBe(false);
  });

  it('reserviert Zeitbudget für die Synthese', () => {
    const { state } = setup();
    vi.spyOn(Date, 'now').mockReturnValue(new Date(state.usage.startedAt).getTime() + 9000);
    expect(state.hasBudgetForResearch()).toBe(false);
    vi.restoreAllMocks();
  });
});

describe('ADR-011 — persistenter Abbruch', () => {
  it('AC-17-02: gesetztes cancel_requested bricht den Run auch ohne Registry ab', () => {
    const { state, repos, run } = setup();
    expect(state.checkCancellation()).toBe(false);
    repos.runs.requestCancel(run.id);
    expect(state.checkCancellation()).toBe(true);
    expect(state.signal.aborted).toBe(true);
    expect(state.hasBudgetForResearch()).toBe(false);
  });
});
