/** Event-Emitter: einzige Schreibstelle für den Execution Trace (Spec 09). */
import type { Repositories } from '@/lib/db/repositories';
import type { AgentEvent, EventType, EventPayloadMap } from '@/lib/contracts/events';
import { clampPayload, eventPayloadSchemas } from '@/lib/contracts/events';
import { logger } from '@/lib/util/logger';
import { redact } from '@/lib/util/errors';

export interface EventEmitterLike {
  emit<T extends EventType>(type: T, payload: EventPayloadMap[T]): AgentEvent<T> | undefined;
}

function scrub(payload: unknown): unknown {
  const json = JSON.stringify(payload);
  const clean = redact(json);
  return JSON.parse(clean) as unknown;
}

export function createEmitter(
  repos: Repositories,
  runId: string,
  conversationId: string,
): EventEmitterLike {
  return {
    emit<T extends EventType>(type: T, payload: EventPayloadMap[T]): AgentEvent<T> | undefined {
      try {
        const schema = eventPayloadSchemas[type];
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          logger.warn('invalid event payload', { module: 'events', runId, type, issue: parsed.error.message });
          return undefined;
        }
        const safe = clampPayload(scrub(parsed.data));
        return repos.events.append(runId, conversationId, type, safe) as AgentEvent<T>;
      } catch (err) {
        logger.error('event append failed', { module: 'events', runId, type, error: String(err) });
        return undefined;
      }
    },
  };
}
