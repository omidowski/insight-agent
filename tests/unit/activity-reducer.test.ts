import { describe, expect, it } from 'vitest';
import { activityReducer, initialActivityState, replayEvents, STATUS_TEXT } from '@/lib/client/activity-reducer';
import type { AgentEvent, EventType } from '@/lib/contracts/events';

let seq = 0;
function event<T extends EventType>(type: T, payload: unknown): AgentEvent {
  seq += 1;
  return {
    id: `evt_${seq}`, runId: 'run_1', conversationId: 'cnv_1', seq,
    ts: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
    type, payload,
  } as AgentEvent;
}

describe('Spec 30 — Activity-Reducer', () => {
  it('AC-30-01: bildet einen Research-Verlauf vollständig ab', () => {
    const events = [
      event('run.started', { userRequestPreview: 'Recherchiere X', mode: 'auto' }),
      event('router.classified', { taskType: 'deep_research', confidence: 0.9, summary: 'ok' }),
      event('plan.created', { steps: [{ id: 's1', title: 'Grunddaten', question: 'Was?' }] }),
      event('status.changed', { from: 'planning', to: 'searching' }),
      event('search.results', { query: 'x statistik', count: 8, topDomains: ['a.example'] }),
      event('source.opened', { sourceId: 'src_1', index: 1, url: 'https://a.example', domain: 'a.example', title: 'A' }),
      event('source.extracted', { sourceId: 'src_1', index: 1, excerptCount: 3, summary: 'ok' }),
      event('sources.compared', { comparedCount: 2, agreementCount: 1, conflictCount: 1 }),
      event('conflict.detected', { claimKey: 'k', description: '765 bzw. 744', sourceIndexes: [1, 2] }),
      event('run.completed', {
        messageId: 'msg_1', sourceCount: 3, citationCount: 4,
        durationMs: 4200, costMicroUsd: 1200, stopReason: 'answered',
      }),
    ];
    const state = replayEvents(events);
    expect(state.visible).toBe(true);
    expect(state.steps).toHaveLength(1);
    expect(state.counters).toMatchObject({ searches: 1, sources: 1, conflicts: 1 });
    expect(state.finished).toBe(true);
    expect(state.summary?.citationCount).toBe(4);
    expect(state.lines.some((l) => l.text.includes('bundes') || l.text.includes('a.example'))).toBe(true);
  });

  it('AC-30-02: Statuszeile ist deutschsprachig', () => {
    const state = activityReducer(initialActivityState, event('status.changed', { from: 'planning', to: 'searching' }));
    expect(STATUS_TEXT[state.status]).toBe('Suche läuft …');
  });

  it('AC-30-03: gleichartige Zeilen werden zusammengefasst', () => {
    let state = initialActivityState;
    for (let i = 0; i < 5; i++) {
      state = activityReducer(state, event('source.opened', {
        sourceId: 'src', index: 1, url: 'https://a.example', domain: 'a.example', title: 'A',
      }));
    }
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0]!.count).toBe(5);
    expect(state.counters.sources).toBe(5);
  });

  it('AC-30-04: Chat-Runs zeigen keine Activity-Karte', () => {
    const state = replayEvents([
      event('run.started', { userRequestPreview: 'Hallo', mode: 'auto' }),
      event('router.classified', { taskType: 'conversation', confidence: 0.99, summary: 'Gruß' }),
    ]);
    expect(state.visible).toBe(false);
  });

  it('unbekannte Event-Typen brechen den Trace nicht ab', () => {
    const state = activityReducer(initialActivityState, { ...event('run.started', {}), type: 'was.auch.immer' } as unknown as AgentEvent);
    expect(state).toBeDefined();
  });

  it('AC-30-05: Replay erzeugt denselben Zustand wie der Livelauf', () => {
    const events = [
      event('run.started', { userRequestPreview: 'x', mode: 'auto' }),
      event('message.delta', { messageId: 'msg_1', delta: 'Hallo ' }),
      event('message.delta', { messageId: 'msg_1', delta: 'Welt' }),
      event('run.cancelled', { atStatus: 'searching' }),
    ];
    const live = events.reduce(activityReducer, initialActivityState);
    expect(replayEvents(events)).toEqual(live);
    expect(live.streamed).toBe('Hallo Welt');
    expect(live.status).toBe('cancelled');
  });
});
