/** Provider für Vektor-Embeddings (lokal deterministisch und API-basiert). */
import { normalize } from './math';
import { logger } from '@/lib/util/logger';

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimension: number;
  readonly model: string;
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
}

/**
 * FNV-1a 32-bit Hash-Funktion für String-Tokens.
 */
function fnv1a(str: string, seed = 0x811c9dc5): number {
  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Schneller, deterministischer Feature-Hashing-Provider (256 Dimensionen).
 * Benötigt keinen externen API-Key und funktioniert offline, in Tests und in Sandboxes.
 * Verwendet Subword-N-Gramme und Worttokens mit TF-Gewichtung für semantische Ähnlichkeit.
 */
export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'deterministic';
  readonly dimension: number;
  readonly model: string;

  constructor(dimension = 256, model = 'deterministic-v1') {
    this.dimension = dimension;
    this.model = model;
  }

  async embed(text: string): Promise<Float32Array> {
    const [result] = await this.embedBatch([text]);
    return result!;
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    return texts.map((text) => this.embedSingle(text));
  }

  private embedSingle(text: string): Float32Array {
    const vec = new Float32Array(this.dimension);
    if (!text || text.trim().length === 0) {
      return vec;
    }

    const normalized = text.toLowerCase().normalize('NFKD');
    const words = normalized.split(/[^a-z0-9_äöüß]+/i).filter((w) => w.length > 0);

    const termCounts = new Map<string, number>();

    // 1. Ganze Worttokens
    for (const word of words) {
      termCounts.set(word, (termCounts.get(word) ?? 0) + 1);

      // 2. Character 3-Gramme für Subword-Ähnlichkeit (z.B. "recherche", "recherchieren")
      if (word.length >= 3) {
        for (let i = 0; i <= word.length - 3; i++) {
          const gram = word.slice(i, i + 3);
          termCounts.set(`3g:${gram}`, (termCounts.get(`3g:${gram}`) ?? 0) + 0.5);
        }
      }
    }

    // 3. Hash-Trick mit Vorzeichen-Hashing
    for (const [term, count] of termCounts.entries()) {
      const weight = 1 + Math.log(count);
      const h1 = fnv1a(term, 0x811c9dc5);
      const h2 = fnv1a(term, 0x9e3779b9);

      const index = h1 % this.dimension;
      const sign = (h2 & 1) === 0 ? 1 : -1;

      vec[index] = ((vec[index] ?? 0) as number) + sign * weight;
    }

    return normalize(vec);
  }
}

export interface OpenAIEmbeddingOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  dimension?: number;
}

/**
 * OpenAI / OpenAI-kompatibler Embedding-Provider (/v1/embeddings).
 * Fällt bei Netzwerkproblemen oder fehlendem Key transparent auf DeterministicEmbeddingProvider zurück.
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai';
  readonly dimension: number;
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;
  private fallback: DeterministicEmbeddingProvider;

  constructor(options: OpenAIEmbeddingOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.model = options.model ?? 'text-embedding-3-small';
    this.dimension = options.dimension ?? 1536;
    this.fallback = new DeterministicEmbeddingProvider(this.dimension, `fallback-${this.model}`);
  }

  async embed(text: string): Promise<Float32Array> {
    const results = await this.embedBatch([text]);
    return results[0]!;
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (!this.apiKey || texts.length === 0) {
      return this.fallback.embedBatch(texts);
    }

    try {
      const res = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: texts.map((t) => t.slice(0, 8000)), // max token guard
        }),
      });

      if (!res.ok) {
        logger.warn('OpenAI embedding request failed, using fallback', {
          module: 'vector',
          status: res.status,
        });
        return this.fallback.embedBatch(texts);
      }

      const json = (await res.json()) as {
        data?: { embedding: number[]; index: number }[];
      };

      if (!json.data || !Array.isArray(json.data)) {
        return this.fallback.embedBatch(texts);
      }

      // Sortiere nach Index, um Reihenfolge zu garantieren
      const sorted = [...json.data].sort((a, b) => a.index - b.index);
      return sorted.map((item) => normalize(new Float32Array(item.embedding)));
    } catch (err) {
      logger.warn('OpenAI embedding network error, using deterministic fallback', {
        module: 'vector',
        error: err instanceof Error ? err.message : String(err),
      });
      return this.fallback.embedBatch(texts);
    }
  }
}

let defaultProvider: EmbeddingProvider | undefined;

export function getEmbeddingProvider(custom?: EmbeddingProvider): EmbeddingProvider {
  if (custom) return custom;
  if (defaultProvider) return defaultProvider;

  const providerType = process.env.EMBEDDING_PROVIDER ?? 'auto';
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;

  if ((providerType === 'openai' || (providerType === 'auto' && apiKey)) && apiKey) {
    defaultProvider = new OpenAIEmbeddingProvider({
      apiKey,
      baseUrl,
      model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
    });
  } else {
    defaultProvider = new DeterministicEmbeddingProvider(256, 'deterministic-v1');
  }

  return defaultProvider;
}

export function resetEmbeddingProvider(): void {
  defaultProvider = undefined;
}
