/** Event-Union des Execution Trace (Spec 05, FR-05-02; Spec 09). */
import { z } from 'zod';
import { errorCodeSchema } from './errors';
import { runStatusSchema, taskTypeSchema } from './domain';

export const eventPayloadSchemas = {
  'run.started': z.object({ userRequestPreview: z.string(), mode: z.string() }),
  'router.classified': z.object({
    taskType: taskTypeSchema, confidence: z.number(), summary: z.string(),
  }),
  'plan.created': z.object({
    steps: z.array(z.object({ id: z.string(), title: z.string(), question: z.string() })),
  }),
  'plan.updated': z.object({
    reason: z.string(),
    steps: z.array(z.object({ id: z.string(), title: z.string(), question: z.string() })),
  }),
  'step.started': z.object({ stepId: z.string(), title: z.string() }),
  'step.completed': z.object({ stepId: z.string(), summary: z.string(), status: z.string() }),
  'tool.call.started': z.object({ toolCallId: z.string(), tool: z.string(), argsSummary: z.string() }),
  'tool.call.completed': z.object({
    toolCallId: z.string(), tool: z.string(), durationMs: z.number(), resultSummary: z.string(),
  }),
  'tool.call.failed': z.object({
    toolCallId: z.string(), tool: z.string(), code: errorCodeSchema, message: z.string(),
  }),
  'search.results': z.object({
    query: z.string(), count: z.number(), topDomains: z.array(z.string()),
  }),
  'source.opened': z.object({
    sourceId: z.string(), index: z.number(), url: z.string(), domain: z.string(), title: z.string(),
  }),
  'source.extracted': z.object({
    sourceId: z.string(), index: z.number(), excerptCount: z.number(), summary: z.string(),
  }),
  'sources.compared': z.object({
    comparedCount: z.number(), agreementCount: z.number(), conflictCount: z.number(),
  }),
  'conflict.detected': z.object({
    claimKey: z.string(), description: z.string(), sourceIndexes: z.array(z.number()),
  }),
  'status.changed': z.object({ from: runStatusSchema, to: runStatusSchema }),
  'message.delta': z.object({ messageId: z.string(), delta: z.string() }),
  'citation.added': z.object({ marker: z.number(), sourceId: z.string(), index: z.number() }),
  'budget.warning': z.object({
    kind: z.enum(['time', 'cost', 'tokens', 'iterations', 'searches', 'sources']),
    used: z.number(), limit: z.number(),
  }),
  'safety.flagged': z.object({ sourceId: z.string(), pattern: z.string(), severity: z.string() }),
  'run.failed': z.object({ code: errorCodeSchema, userMessage: z.string() }),
  'run.cancelled': z.object({ atStatus: runStatusSchema }),
  'run.completed': z.object({
    messageId: z.string(), sourceCount: z.number(), citationCount: z.number(),
    durationMs: z.number(), costMicroUsd: z.number(), stopReason: z.string(),
  }),
} as const;

export type EventType = keyof typeof eventPayloadSchemas;
export const EVENT_TYPES = Object.keys(eventPayloadSchemas) as EventType[];

export type EventPayloadMap = {
  [K in EventType]: z.infer<(typeof eventPayloadSchemas)[K]>;
};

export interface AgentEvent<T extends EventType = EventType> {
  id: string;
  runId: string;
  conversationId: string;
  seq: number;
  ts: string;
  type: T;
  payload: EventPayloadMap[T];
}

export const TERMINAL_EVENTS: ReadonlySet<EventType> = new Set<EventType>([
  'run.completed', 'run.failed', 'run.cancelled',
]);

export function isEventType(value: string): value is EventType {
  return Object.prototype.hasOwnProperty.call(eventPayloadSchemas, value);
}

const MAX_PAYLOAD_BYTES = 8192;

/** Kürzt zu große Payloads, damit der Trace funktionsfähig bleibt (Spec 09, Edge 4). */
export function clampPayload(payload: unknown): unknown {
  const json = JSON.stringify(payload);
  if (json.length <= MAX_PAYLOAD_BYTES) return payload;
  const clamped: Record<string, unknown> = { truncated: true };
  if (payload && typeof payload === 'object') {
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      clamped[k] = typeof v === 'string' && v.length > 500 ? `${v.slice(0, 500)}…` : v;
    }
  }
  return clamped;
}
