import { describe, expect, it } from 'vitest';
import { EVENT_TYPES, eventPayloadSchemas, clampPayload, isEventType } from '@/lib/contracts/events';
import { toAppError, appError } from '@/lib/util/errors';
import { errorCodeSchema } from '@/lib/contracts/errors';
import { toStrictJsonSchema } from '@/lib/contracts/json-schema';
import { ALL_TOOLS } from '@/lib/tools/registry';

describe('Spec 05 — Shared Contracts', () => {
  it('AC-05-01: jede EventType hat ein Payload-Schema', () => {
    for (const type of EVENT_TYPES) {
      expect(eventPayloadSchemas[type]).toBeDefined();
      expect(isEventType(type)).toBe(true);
    }
    expect(isEventType('nicht.existent')).toBe(false);
  });

  it('AC-05-02: beliebige Fehler werden zur vollständigen Envelope', () => {
    for (const input of ['kaputt', new Error('x'), { weird: true }, 42]) {
      const error = toAppError(input);
      expect(errorCodeSchema.safeParse(error.code).success).toBe(true);
      expect(error.userMessage.length).toBeGreaterThan(0);
      expect(typeof error.retryable).toBe('boolean');
    }
  });

  it('AC-05-03: alle Tool-Schemas ergeben gültiges JSON-Schema', () => {
    for (const tool of ALL_TOOLS) {
      const schema = toStrictJsonSchema(tool.parameters as never);
      expect(schema.type).toBe('object');
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required).toEqual(Object.keys(schema.properties ?? {}));
      expect(JSON.stringify(schema)).not.toContain('undefined');
    }
  });

  it('kürzt übergroße Payloads', () => {
    const clamped = clampPayload({ text: 'x'.repeat(20000) }) as { truncated?: boolean; text: string };
    expect(clamped.truncated).toBe(true);
    expect(clamped.text.length).toBeLessThan(600);
  });

  it('jeder Fehlercode hat eine deutsche Nutzermeldung ohne Interna (AC-38-04)', () => {
    for (const code of errorCodeSchema.options) {
      const error = appError(code, 'technisch: /Users/x/secret sk-live-1');
      expect(error.userMessage.length).toBeGreaterThan(5);
      expect(error.userMessage).not.toContain('/Users/');
      expect(error.userMessage).not.toContain('sk-live');
    }
  });
});

describe('Spec 38 — Fehler-Envelope über Bundle-Grenzen', () => {
  it('erkennt eine Envelope strukturell, auch ohne instanceof-Identität', () => {
    // Next.js kann dieselbe Klasse in mehreren Bundles laden; dann schlägt instanceof fehl.
    const fremdeException = {
      name: 'AppErrorException',
      message: 'You have no credits remaining.',
      appError: {
        code: 'LLM_UNAVAILABLE',
        message: 'Guthaben erschöpft',
        userMessage: 'Das OpenAI-Guthaben dieses Kontos ist aufgebraucht. Bitte Abrechnung prüfen.',
        retryable: false,
      },
    };
    const result = toAppError(fremdeException);
    expect(result.code).toBe('LLM_UNAVAILABLE');
    expect(result.userMessage).toContain('Guthaben');
    expect(result.retryable).toBe(false);
  });

  it('erkennt auch eine blanke Envelope ohne Wrapper', () => {
    const result = toAppError({
      code: 'RATE_LIMITED', message: 'x', userMessage: 'Zu viele Anfragen.', retryable: true,
    });
    expect(result.code).toBe('RATE_LIMITED');
  });

  it('unbekannte Objekte bleiben INTERNAL', () => {
    expect(toAppError({ irgendwas: 1 }).code).toBe('INTERNAL');
    expect(toAppError(new Error('kaputt')).code).toBe('INTERNAL');
  });
});
