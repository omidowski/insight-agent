import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { extractJsonCandidate, unwrapSchemaEcho, parseStructured, schemaInstruction } from '@/lib/llm/json-output';
import { extractionOutputSchema } from '@/lib/contracts/schemas';

const simple = z.object({ items: z.array(z.string()), summary: z.string() });

describe('Spec 06 — Auswertung strukturierter Antworten', () => {
  it('nimmt sauberes JSON unverändert an', () => {
    expect(parseStructured('{"items":["a"],"summary":"s"}', simple)).toEqual({ items: ['a'], summary: 's' });
  });

  it('entfernt einen Markdown-Codeblock', () => {
    expect(parseStructured('```json\n{"items":[],"summary":"s"}\n```', simple)).toEqual({ items: [], summary: 's' });
  });

  it('ignoriert erklärendes Beiwerk vor und nach dem Objekt', () => {
    const raw = 'Hier ist das Ergebnis:\n{"items":["a"],"summary":"s"}\nIch hoffe, das hilft.';
    expect(parseStructured(raw, simple)).toEqual({ items: ['a'], summary: 's' });
  });

  it('holt die Nutzlast aus einem zurückgegebenen Schema', () => {
    const raw = JSON.stringify({
      type: 'object',
      properties: { items: ['a', 'b'], summary: 'zusammengefasst' },
      required: ['items', 'summary'],
      additionalProperties: false,
    });
    expect(parseStructured(raw, simple)).toEqual({ items: ['a', 'b'], summary: 'zusammengefasst' });
  });

  it('rettet die echte Fehlantwort von NVIDIA-Nemotron', () => {
    // Wörtlich so beobachtet: die Daten stimmten, nur die Verpackung war das Schema.
    const raw = JSON.stringify({
      type: 'object',
      properties: {
        items: [
          {
            claimKey: 'weather_hamburg_current_condition',
            label: 'Aktuelle Wetterbedingung',
            value: '15°',
            excerpt: 'Wetter Hamburg aktuell 15° 90 Min.',
            confidence: 0.95,
          },
        ],
        summary: 'Hamburg hat aktuell 15 Grad.',
      },
      required: ['items', 'summary'],
      additionalProperties: false,
    });
    const parsed = parseStructured(raw, extractionOutputSchema);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.value).toBe('15°');
    expect(parsed.summary).toBe('Hamburg hat aktuell 15 Grad.');
  });

  it('lässt ein echtes Schema unangetastet — dort steht keine Nutzlast', () => {
    const realSchema = {
      type: 'object',
      properties: { items: { type: 'array' }, summary: { type: 'string' } },
      required: ['items', 'summary'],
    };
    expect(unwrapSchemaEcho(realSchema)).toBe(realSchema);
  });

  it('lässt Nutzlast mit einem Feld namens „properties" unangetastet', () => {
    const payload = { properties: { farbe: 'rot' }, summary: 's' };
    expect(unwrapSchemaEcho(payload)).toBe(payload);
  });

  it('wirft mit der Zod-Meldung, wenn auch das Entpacken nicht hilft', () => {
    expect(() => parseStructured('{"items":"kein array","summary":1}', simple)).toThrow(/items|summary/);
  });

  it('meldet ungültiges JSON', () => {
    expect(() => parseStructured('gar kein json', simple)).toThrow();
  });

  it('extractJsonCandidate greift das äußerste Objekt', () => {
    expect(extractJsonCandidate('vorher {"a":{"b":1}} nachher')).toBe('{"a":{"b":1}}');
  });

  it('die Anweisung nennt die erwarteten Schlüssel und verbietet das Schema-Echo', () => {
    const hint = schemaInstruction({ type: 'object', properties: { items: {}, summary: {} } });
    expect(hint).toContain('items, summary');
    expect(hint).toContain('nicht das Schema');
  });
});

describe('Spec 24 — unvollständige Angaben reißen die übrigen nicht mit', () => {
  const vollstaendig = {
    claimKey: 'temperatur_aktuell', label: 'Temperatur', value: '15°',
    excerpt: 'aktuell 15°', confidence: 0.95,
  };

  it('behält die brauchbaren Einträge und verwirft nur den fehlerhaften', () => {
    // Wörtlich beobachtet: sechs von sieben Angaben vollständig, die siebte ohne „value".
    const raw = JSON.stringify({
      items: [vollstaendig, { claimKey: 'wetter_heute', label: 'Wetter', excerpt: 'Schauer', confidence: 0.9 }],
      summary: 'Hamburg, 15 Grad.',
    });
    const parsed = parseStructured(raw, extractionOutputSchema);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.claimKey).toBe('temperatur_aktuell');
  });

  it('liefert eine leere Liste, wenn kein Eintrag brauchbar ist', () => {
    const raw = JSON.stringify({ items: [{ label: 'unvollständig' }], summary: 'nichts' });
    expect(parseStructured(raw, extractionOutputSchema).items).toEqual([]);
  });

  it('scheitert weiterhin, wenn summary fehlt', () => {
    expect(() => parseStructured(JSON.stringify({ items: [vollstaendig] }), extractionOutputSchema)).toThrow();
  });

  it('rettet beide Fehler zugleich: Schema-Echo und unvollständiger Eintrag', () => {
    const raw = JSON.stringify({
      type: 'object',
      properties: { items: [vollstaendig, { label: 'kaputt' }], summary: 'ok' },
      required: ['items', 'summary'],
    });
    const parsed = parseStructured(raw, extractionOutputSchema);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.summary).toBe('ok');
  });
});
