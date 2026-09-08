/** Modellkatalog des aktiven Anbieters (Spec 48). */
import { getConfig } from '@/lib/config/env';
import { appError, AppErrorException } from '@/lib/util/errors';
import { logger } from '@/lib/util/logger';

export interface ModelInfo {
  id: string;
  recommended: boolean;
  note?: string;
}

export interface ModelCatalog {
  provider: string;
  models: ModelInfo[];
  currentFast: string;
  currentMain: string;
  fetchedAt: string;
}

/** Kuratierte Empfehlungen je Anbieter — der Rest kommt live vom Anbieter. */
const RECOMMENDED: Record<string, { id: string; note: string }[]> = {
  openai: [
    { id: 'gpt-5', note: 'Höchste Qualität, teurer' },
    { id: 'gpt-5-mini', note: 'Guter Kompromiss, Standard' },
    { id: 'gpt-4.1', note: 'Bewährt, schnell' },
    { id: 'gpt-4.1-mini', note: 'Günstig' },
  ],
  nvidia: [
    { id: 'meta/llama-3.3-70b-instruct', note: 'Solide Allzweckwahl' },
    { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', note: 'Auf Reasoning optimiert' },
    { id: 'qwen/qwen2.5-72b-instruct', note: 'Stark bei strukturierten Ausgaben' },
    { id: 'deepseek-ai/deepseek-r1', note: 'Reasoning, langsamer' },
    { id: 'mistralai/mistral-large-2-instruct', note: 'Gut für europäische Sprachen' },
    { id: 'meta/llama-3.1-8b-instruct', note: 'Sehr schnell, einfache Aufgaben' },
  ],
  compatible: [],
};

/** Modelle, die für dieses Produkt ungeeignet sind (kein Chat/Text). */
const EXCLUDE = /(embed|whisper|tts|dall-e|moderation|rerank|vision-ocr|audio|image|clip|nemoretriever|codestral-mamba)/i;

let cache: { at: number; value: ModelCatalog } | undefined;
const TTL_MS = 300_000;

function endpointFor(): { baseUrl: string; apiKey: string; provider: string } {
  const config = getConfig();
  switch (config.llmProvider) {
    case 'openai':
      return { baseUrl: 'https://api.openai.com/v1', apiKey: config.OPENAI_API_KEY ?? '', provider: 'openai' };
    case 'nvidia':
      return { baseUrl: config.NVIDIA_BASE_URL, apiKey: config.NVIDIA_API_KEY ?? '', provider: 'nvidia' };
    case 'compatible':
      return { baseUrl: config.LLM_BASE_URL ?? '', apiKey: config.LLM_API_KEY ?? '', provider: 'compatible' };
    default:
      throw new AppErrorException(
        appError('LLM_NOT_CONFIGURED', 'kein Anbieter konfiguriert', {
          retryable: false,
          userMessage: 'Es ist kein Sprachmodell konfiguriert.',
        }),
      );
  }
}

export async function getModelCatalog(force = false): Promise<ModelCatalog> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const config = getConfig();
  const { baseUrl, apiKey, provider } = endpointFor();
  const recommended = RECOMMENDED[provider] ?? [];
  const recommendedIds = new Map(recommended.map((r) => [r.id, r.note]));

  let ids: string[] = [];
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      const body = (await response.json()) as { data?: { id?: string }[] };
      ids = (body.data ?? []).map((m) => m.id ?? '').filter((id) => id.length > 0 && !EXCLUDE.test(id));
    } else {
      logger.warn('Modellliste nicht abrufbar', { module: 'llm', status: response.status });
    }
  } catch (err) {
    logger.warn('Modellliste nicht abrufbar', { module: 'llm', error: String(err).slice(0, 120) });
  }

  // Empfehlungen zuerst, dann alle übrigen alphabetisch.
  const all = new Set<string>([...recommendedIds.keys(), ...ids]);
  const models: ModelInfo[] = [
    ...recommended
      .filter((r) => ids.length === 0 || ids.includes(r.id))
      .map((r) => ({ id: r.id, recommended: true, note: r.note })),
    ...[...all]
      .filter((id) => !recommendedIds.has(id))
      .sort()
      .map((id) => ({ id, recommended: false })),
  ];

  const value: ModelCatalog = {
    provider,
    models,
    currentFast: config.activeModelFast,
    currentMain: config.activeModelMain,
    fetchedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), value };
  return value;
}

export function clearModelCatalogCache(): void {
  cache = undefined;
}
