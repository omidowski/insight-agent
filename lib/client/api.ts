/** Typisierte Client-Aufrufe gegen die API (Spec 08). */
import type { ResearchOptions } from '@/lib/contracts/domain';
import type { ConversationDetail, ConversationSummary, Mode } from './types';
import type { AgentEvent } from '@/lib/contracts/events';
import type { Citation, Conflict, Message, RunStatus, SourceRecord, ExcerptRecord } from '@/lib/contracts/domain';

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    let message = `Fehler ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { userMessage?: string } };
      if (body.error?.userMessage) message = body.error.userMessage;
    } catch {
      /* kein JSON-Body */
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  listConversations: () => request<{ conversations: ConversationSummary[] }>('/api/conversations'),
  getConversation: (id: string) => request<ConversationDetail>(`/api/conversations/${id}`),
  renameConversation: (id: string, title: string) =>
    request<unknown>(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteConversation: (id: string) => request<void>(`/api/conversations/${id}`, { method: 'DELETE' }),
  listModels: () =>
    request<{
      provider: string;
      models: { id: string; recommended: boolean; note?: string }[];
      currentFast: string | null;
      currentMain: string | null;
    }>('/api/models'),
  createRun: (
    message: string,
    conversationId: string | null,
    mode: Mode,
    model?: string,
    researchOptions?: ResearchOptions,
  ) =>
    request<{ runId: string; conversationId: string; userMessageId: string }>('/api/runs', {
      method: 'POST',
      body: JSON.stringify({
        message, mode,
        ...(conversationId ? { conversationId } : {}),
        ...(model ? { model } : {}),
        ...(researchOptions ? { researchOptions } : {}),
      }),
    }),
  cancelRun: (runId: string) => request<unknown>(`/api/runs/${runId}/cancel`, { method: 'POST' }),
  getRun: (runId: string) =>
    request<{
      run: { id: string; status: RunStatus; error: { userMessage: string } | null };
      sources: SourceRecord[];
      excerpts: ExcerptRecord[];
      conflicts: Conflict[];
      message: Message | null;
      citations: Citation[];
    }>(`/api/runs/${runId}`),
  vectorSearch: (query: string, options?: { types?: string[]; limit?: number; minSimilarity?: number }) => {
    const params = new URLSearchParams({ q: query });
    if (options?.types && options.types.length > 0) params.set('types', options.types.join(','));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.minSimilarity) params.set('minSimilarity', String(options.minSimilarity));
    return request<{
      ok: boolean;
      query: string;
      total: number;
      results: Array<{
        id: string;
        entityType: string;
        entityId: string;
        parentId: string | null;
        content: string;
        metadata: Record<string, unknown>;
        similarity: number;
        createdAt: string;
      }>;
    }>(`/api/vector/search?${params.toString()}`);
  },
  getVectorStats: () =>
    request<{
      ok: boolean;
      stats: {
        total: number;
        byType: Record<string, number>;
        dimensions: number;
        model: string;
        lastUpdatedAt: string | null;
      };
    }>('/api/vector/stats'),
  syncVectorDb: () =>
    request<{
      ok: boolean;
      indexed: number;
      byType: Record<string, number>;
      durationMs: number;
    }>('/api/vector/sync', { method: 'POST' }),
};

export type StreamHandlers = {
  onEvent: (event: AgentEvent) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

export function openRunStream(runId: string, afterSeq: number, handlers: StreamHandlers): () => void {
  const source = new EventSource(`/api/runs/${runId}/events?after=${afterSeq}`);
  let finished = false;

  const handle = (raw: MessageEvent<string>) => {
    try {
      const event = JSON.parse(raw.data) as AgentEvent;
      handlers.onEvent(event);
      if (event.type === 'run.completed' || event.type === 'run.failed' || event.type === 'run.cancelled') {
        finished = true;
        source.close();
        handlers.onDone();
      }
    } catch {
      /* fehlerhaftes Event ignorieren */
    }
  };

  source.addEventListener('message', handle as EventListener);
  for (const type of [
    'run.started', 'router.classified', 'plan.created', 'plan.updated', 'step.started', 'step.completed',
    'tool.call.started', 'tool.call.completed', 'tool.call.failed', 'search.results', 'source.opened',
    'source.extracted', 'sources.compared', 'conflict.detected', 'status.changed', 'message.delta',
    'citation.added', 'budget.warning', 'safety.flagged', 'run.failed', 'run.cancelled', 'run.completed',
  ]) {
    source.addEventListener(type, handle as EventListener);
  }

  source.addEventListener('error', () => {
    if (finished) return;
    if (source.readyState === EventSource.CLOSED) {
      handlers.onError('Verbindung zum Agenten unterbrochen.');
    }
  });

  return () => {
    finished = true;
    source.close();
  };
}
