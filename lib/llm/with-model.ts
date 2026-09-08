/** Legt für alle Aufrufe eines Runs ein vom Nutzer gewähltes Modell fest (Spec 48). */
import type { LLMProvider, ObjectRequest, TextRequest, TextResult } from './provider';

export function withModel(provider: LLMProvider, modelName: string | undefined): LLMProvider {
  if (!modelName) return provider;
  const apply = <T extends TextRequest>(req: T): T => ({ ...req, modelName });
  return {
    name: provider.name,
    generateText: (req: TextRequest): Promise<TextResult> => provider.generateText(apply(req)),
    streamText: (req: TextRequest): AsyncIterable<string> => provider.streamText(apply(req)),
    generateObject: <T>(req: ObjectRequest<T>): Promise<T> => provider.generateObject(apply(req)),
  };
}
