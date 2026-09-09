/** API-Request-/Response-Schemas und Modell-Ausgabeschemas (Spec 05, FR-05-03). */
import { z } from 'zod';
import { runModeSchema, taskTypeSchema } from './domain';

export const createRunRequestSchema = z.object({
  conversationId: z.string().min(1).optional(),
  message: z.string().min(1, 'Nachricht darf nicht leer sein').max(20000, 'Nachricht ist zu lang'),
  mode: runModeSchema.optional().default('auto'),
  /** Optionale Modellwahl des Nutzers; leer = konfiguriertes Standardmodell. */
  model: z.string().min(1).max(120).optional(),
});
export type CreateRunRequest = z.infer<typeof createRunRequestSchema>;

export const createConversationRequestSchema = z.object({
  title: z.string().min(1).max(120).optional(),
});

export const patchConversationRequestSchema = z.object({
  title: z.string().min(1).max(120),
});

// --- Modell-Ausgabeschemas (Structured Outputs) ---

export const routerOutputSchema = z.object({
  taskType: taskTypeSchema,
  confidence: z.number().min(0).max(1),
  summary: z.string().max(160),
  clarificationNeeded: z.boolean(),
});
export type RouterOutput = z.infer<typeof routerOutputSchema>;

export const planOutputSchema = z.object({
  steps: z.array(
    z.object({
      title: z.string().max(120),
      question: z.string().max(300),
      dependsOn: z.array(z.number()),
    }),
  ),
});
export type PlanOutput = z.infer<typeof planOutputSchema>;

export const queryOutputSchema = z.object({
  queries: z.array(z.string().max(200)),
});
export type QueryOutput = z.infer<typeof queryOutputSchema>;

export const extractionItemSchema = z.object({
  claimKey: z.string().max(120),
  label: z.string().max(160),
  value: z.string().max(300),
  excerpt: z.string().max(600),
  confidence: z.number().min(0).max(1),
});

/**
 * Die Auswertung einer Quelle ist eine Ernte, kein Vertrag: Ein unvollständiger Eintrag
 * darf die übrigen nicht mitreißen. Beobachtet bei NVIDIA-Nemotron — sechs von sieben
 * Angaben waren vollständig, die siebte ohne `value` verwarf alle sieben. Fehlerhafte
 * Einträge werden verworfen, die brauchbaren bleiben; jedes Zitat wird ohnehin danach
 * gegen den Quelltext geprüft.
 */
export const extractionOutputSchema = z.object({
  items: z.preprocess(
    (value) =>
      Array.isArray(value) ? value.filter((entry) => extractionItemSchema.safeParse(entry).success) : value,
    z.array(extractionItemSchema),
  ),
  summary: z.string().max(300),
});
export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;

export const followupOutputSchema = z.object({
  needsNewResearch: z.boolean(),
  reason: z.string().max(200),
});
export type FollowupOutput = z.infer<typeof followupOutputSchema>;

export const selectionOutputSchema = z.object({
  urls: z.array(z.string()),
});

export const titleOutputSchema = z.object({ title: z.string().max(60) });
