/**
 * Auswertung strukturierter Modellantworten (Spec 06).
 *
 * Schwächere Modelle scheitern an Structured Outputs auf immer denselben Wegen. Statt sie
 * mit einem teuren Reparaturaufruf zu bestrafen, korrigiert dieses Modul die Muster, bei
 * denen die Daten nachweislich vollständig vorliegen und nur falsch verpackt sind:
 *
 * - **Schema-Echo.** Das Modell gibt das JSON-Schema zurück und legt seine Daten in
 *   `properties` ab: `{type:"object", properties:{items:[…]}, required:[…]}` statt
 *   `{items:[…]}`. Beobachtet bei NVIDIA-Nemotron; die Daten selbst waren korrekt.
 * - **Codeblock.** Antwort in ```json … ``` eingewickelt.
 * - **Beiwerk.** Erklärender Text vor oder nach dem Objekt.
 *
 * Alles darüber hinaus bleibt ein Fehler — geraten wird hier nichts.
 */
import type { z } from 'zod';

/** Schlüssel, die ein JSON-Schema ausmachen, aber in keiner Nutzlast dieses Projekts vorkommen. */
const SCHEMA_MARKERS = ['properties', 'required', 'additionalProperties', '$schema', 'definitions'];

/** Holt das JSON-Objekt aus einer Antwort mit Codeblock oder erklärendem Beiwerk. */
export function extractJsonCandidate(raw: string): string {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
}

/**
 * Erkennt ein zurückgegebenes JSON-Schema und holt die Nutzlast aus `properties`.
 * Gibt den Wert unverändert zurück, wenn es sich nicht um ein Schema-Echo handelt.
 */
export function unwrapSchemaEcho(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;

  const properties = record.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return value;

  // Ein echtes Schema nennt mindestens zwei seiner Struktur-Schlüssel.
  const markers = SCHEMA_MARKERS.filter((key) => key in record).length;
  if (markers < 2 && record.type !== 'object') return value;

  // In einem echten Schema ist jeder Eintrag unter properties selbst ein Schema
  // ({type: …}). Enthält er stattdessen Nutzdaten, ist es ein Echo.
  const entries = Object.values(properties as Record<string, unknown>);
  const looksLikeSchema = entries.every(
    (entry) => entry !== null && typeof entry === 'object' && !Array.isArray(entry) && 'type' in (entry as object),
  );
  if (entries.length > 0 && looksLikeSchema) return value;

  return properties;
}

/**
 * Wertet eine Modellantwort gegen ein Zod-Schema aus. Wirft mit der Zod-Meldung,
 * wenn auch die entpackte Fassung nicht passt — diese Meldung geht in den Reparaturaufruf.
 */
export function parseStructured<T>(raw: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T {
  const value: unknown = JSON.parse(extractJsonCandidate(raw));

  const direct = schema.safeParse(value);
  if (direct.success) return direct.data;

  const unwrapped = unwrapSchemaEcho(value);
  if (unwrapped !== value) {
    const second = schema.safeParse(unwrapped);
    if (second.success) return second.data;
  }
  throw new Error(direct.error.message);
}

/**
 * Hinweis für Modelle, die zum Schema-Echo neigen. Das Schema allein reicht ihnen nicht —
 * sie brauchen die Ansage, dass die Daten selbst gefragt sind, nicht deren Beschreibung.
 */
export function schemaInstruction(jsonSchema: unknown): string {
  const keys =
    jsonSchema && typeof jsonSchema === 'object' && 'properties' in jsonSchema
      ? Object.keys((jsonSchema as { properties: Record<string, unknown> }).properties)
      : [];
  const keyHint =
    keys.length > 0
      ? `Das Objekt hat auf oberster Ebene genau diese Schlüssel: ${keys.join(', ')}. `
      : '';
  return (
    `Antworte ausschließlich mit gültigem JSON nach diesem Schema, ohne Markdown-Codeblock. ` +
    `${keyHint}Gib die Daten selbst aus, nicht das Schema: die Schlüssel "type", "properties", ` +
    `"required" und "additionalProperties" dürfen in deiner Antwort nicht vorkommen.\n` +
    JSON.stringify(jsonSchema)
  );
}
