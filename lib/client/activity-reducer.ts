/** Reine Abbildung der Eventfolge auf den Activity-State (Spec 30). */
import type { AgentEvent, EventType } from '@/lib/contracts/events';
import type { RunStatus } from '@/lib/contracts/domain';

export interface ActivityLine {
  id: string;
  kind: 'plan' | 'search' | 'source' | 'compare' | 'status' | 'warning' | 'error' | 'info';
  text: string;
  ts: string;
  count?: number;
}

export interface ActivityStep {
  id: string;
  title: string;
  question: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface ActivityState {
  status: RunStatus;
  visible: boolean;
  steps: ActivityStep[];
  lines: ActivityLine[];
  counters: { searches: number; sources: number; iterations: number; conflicts: number; citations: number };
  summary?: { durationMs: number; sourceCount: number; citationCount: number; costMicroUsd: number; stopReason: string };
  error?: string;
  messageId?: string;
  streamed: string;
  finished: boolean;
}

export const STATUS_TEXT: Record<RunStatus, string> = {
  idle: 'Bereit',
  routing: 'Anfrage wird analysiert …',
  planning: 'Recherche wird geplant …',
  searching: 'Suche läuft …',
  reading_sources: 'Quellen werden gelesen …',
  extracting: 'Informationen werden extrahiert …',
  comparing: 'Quellen werden verglichen …',
  synthesizing: 'Antwort wird erstellt …',
  completed: 'Recherche abgeschlossen',
  failed: 'Fehlgeschlagen',
  cancelled: 'Abgebrochen',
  paused: 'Pausiert',
};

export const initialActivityState: ActivityState = {
  status: 'idle',
  visible: false,
  steps: [],
  lines: [],
  counters: { searches: 0, sources: 0, iterations: 0, conflicts: 0, citations: 0 },
  streamed: '',
  finished: false,
};

const MAX_LINES = 200;

function push(state: ActivityState, line: Omit<ActivityLine, 'id'>): ActivityLine[] {
  const previous = state.lines[state.lines.length - 1];
  // Gleichartige Folgeereignisse zusammenfassen (Spec 30, Edge 1)
  if (previous && previous.kind === line.kind && previous.text === line.text) {
    const merged = { ...previous, count: (previous.count ?? 1) + 1 };
    return [...state.lines.slice(0, -1), merged];
  }
  const lines = [...state.lines, { ...line, id: `${state.lines.length}-${line.ts}` }];
  return lines.length > MAX_LINES ? lines.slice(lines.length - MAX_LINES) : lines;
}

export function activityReducer(state: ActivityState, event: AgentEvent): ActivityState {
  const ts = event.ts;
  switch (event.type as EventType) {
    case 'run.started':
      return { ...initialActivityState, status: 'routing', lines: push(state, { kind: 'info', text: 'Anfrage empfangen', ts }) };
    case 'router.classified': {
      const payload = event.payload as { taskType: string; confidence: number };
      const research = !['conversation', 'knowledge_question', 'unsafe_or_refused'].includes(payload.taskType);
      return {
        ...state,
        visible: research,
        lines: push(state, { kind: 'info', text: `Anfrage analysiert (${payload.taskType})`, ts }),
      };
    }
    case 'plan.created':
    case 'plan.updated': {
      const payload = event.payload as { steps: { id: string; title: string; question: string }[]; reason?: string };
      const steps: ActivityStep[] = payload.steps.map((s) => ({ ...s, status: 'pending' as const }));
      const existing = new Map(state.steps.map((s) => [s.id, s]));
      for (const step of steps) if (!existing.has(step.id)) existing.set(step.id, step);
      return {
        ...state,
        visible: true,
        steps: Array.from(existing.values()),
        counters: event.type === 'plan.updated'
          ? { ...state.counters, iterations: state.counters.iterations + 1 }
          : state.counters,
        lines: push(state, {
          kind: 'plan',
          text: payload.reason ?? `Recherche geplant (${payload.steps.length} Teilfragen)`,
          ts,
        }),
      };
    }
    case 'step.started': {
      const payload = event.payload as { stepId: string; title: string };
      return {
        ...state,
        steps: state.steps.map((s) => (s.id === payload.stepId ? { ...s, status: 'running' } : s)),
      };
    }
    case 'step.completed': {
      const payload = event.payload as { stepId: string; summary: string; status: string };
      return {
        ...state,
        steps: state.steps.map((s) =>
          s.id === payload.stepId ? { ...s, status: payload.status === 'completed' ? 'completed' : 'failed' } : s,
        ),
        lines: push(state, { kind: 'info', text: payload.summary, ts }),
      };
    }
    case 'search.results': {
      const payload = event.payload as { query: string; count: number };
      return {
        ...state,
        visible: true,
        counters: { ...state.counters, searches: state.counters.searches + 1 },
        lines: push(state, { kind: 'search', text: `Suche: „${payload.query}" — ${payload.count} Treffer`, ts }),
      };
    }
    case 'source.opened': {
      const payload = event.payload as { domain: string; index: number };
      return {
        ...state,
        counters: { ...state.counters, sources: state.counters.sources + 1 },
        lines: push(state, { kind: 'source', text: `Quelle ${payload.index} geöffnet: ${payload.domain}`, ts }),
      };
    }
    case 'source.extracted': {
      const payload = event.payload as { index: number; excerptCount: number };
      return {
        ...state,
        lines: push(state, {
          kind: 'source',
          text: `Quelle ${payload.index}: ${payload.excerptCount} Angaben extrahiert`,
          ts,
        }),
      };
    }
    case 'sources.compared': {
      const payload = event.payload as { comparedCount: number; conflictCount: number };
      return {
        ...state,
        lines: push(state, {
          kind: 'compare',
          text: `${payload.comparedCount} Angaben verglichen — ${payload.conflictCount} Abweichung(en)`,
          ts,
        }),
      };
    }
    case 'conflict.detected': {
      const payload = event.payload as { description: string };
      return {
        ...state,
        counters: { ...state.counters, conflicts: state.counters.conflicts + 1 },
        lines: push(state, { kind: 'warning', text: `Abweichung: ${payload.description}`, ts }),
      };
    }
    case 'safety.flagged': {
      const payload = event.payload as { sourceId: string; severity: string };
      return {
        ...state,
        lines: push(state, {
          kind: 'warning',
          text: `Verdächtiger Inhalt in einer Quelle ignoriert (${payload.severity})`,
          ts,
        }),
      };
    }
    case 'status.changed': {
      const payload = event.payload as { to: RunStatus };
      return { ...state, status: payload.to };
    }
    case 'message.delta': {
      const payload = event.payload as { messageId: string; delta: string };
      return { ...state, messageId: payload.messageId, streamed: state.streamed + payload.delta };
    }
    case 'citation.added':
      return { ...state, counters: { ...state.counters, citations: state.counters.citations + 1 } };
    case 'budget.warning': {
      const payload = event.payload as { kind: string; used: number; limit: number };
      return {
        ...state,
        lines: push(state, { kind: 'warning', text: `Budgetgrenze erreicht (${payload.kind})`, ts }),
      };
    }
    case 'tool.call.failed': {
      const payload = event.payload as { tool: string; message: string };
      return {
        ...state,
        lines: push(state, { kind: 'error', text: `${payload.tool}: ${payload.message}`, ts }),
      };
    }
    case 'run.completed': {
      const payload = event.payload as {
        messageId: string; sourceCount: number; citationCount: number;
        durationMs: number; costMicroUsd: number; stopReason: string;
      };
      return {
        ...state,
        status: 'completed',
        finished: true,
        messageId: payload.messageId,
        summary: {
          durationMs: payload.durationMs,
          sourceCount: payload.sourceCount,
          citationCount: payload.citationCount,
          costMicroUsd: payload.costMicroUsd,
          stopReason: payload.stopReason,
        },
        lines: push(state, { kind: 'status', text: 'Recherche abgeschlossen', ts }),
      };
    }
    case 'run.failed': {
      const payload = event.payload as { userMessage: string };
      return {
        ...state,
        status: 'failed',
        finished: true,
        error: payload.userMessage,
        lines: push(state, { kind: 'error', text: payload.userMessage, ts }),
      };
    }
    case 'run.cancelled':
      return {
        ...state,
        status: 'cancelled',
        finished: true,
        lines: push(state, { kind: 'status', text: 'Abgebrochen', ts }),
      };
    default:
      return state;
  }
}

export function replayEvents(events: AgentEvent[]): ActivityState {
  return events.reduce(activityReducer, initialActivityState);
}
