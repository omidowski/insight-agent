/** Provider-unabhängige LLM-Schnittstelle (Spec 06, FR-06-01). */
import type { z } from 'zod';

export type LLMInput =
  | { role: 'user' | 'assistant'; text: string }
  | { role: 'data'; label: string; content: string };

export type ModelTier = 'fast' | 'main';

export interface TextRequest {
  system: string;
  input: LLMInput[];
  model?: ModelTier;
  /** Überschreibt die Stufenzuordnung mit einem konkreten Modellnamen (Nutzerauswahl). */
  modelName?: string;
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  runId?: string;
  /** Zweck des Aufrufs, z. B. 'router' | 'plan' | 'queries' | 'extraction' | 'synthesis'. */
  purpose: string;
}

export interface ObjectRequest<T> extends TextRequest {
  schema: z.ZodType<T>;
  schemaName: string;
}

export interface TextResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimated: boolean;
}

export interface UsageRecord {
  runId?: string;
  kind: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
  estimated: boolean;
}

export type UsageSink = (usage: UsageRecord) => void;

export interface LLMProvider {
  readonly name: string;
  generateText(req: TextRequest): Promise<TextResult>;
  streamText(req: TextRequest): AsyncIterable<string>;
  generateObject<T>(req: ObjectRequest<T>): Promise<T>;
}
