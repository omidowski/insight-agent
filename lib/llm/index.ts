/** Auswahl des Providers je nach Konfiguration (Spec 06, ADR-012/ADR-013). */
import { getConfig } from '@/lib/config/env';
import type { LLMProvider, UsageSink } from './provider';
import { OpenAIProvider } from './openai';
import { OpenAICompatibleProvider } from './openai-compatible';
import { appError, AppErrorException } from '@/lib/util/errors';

export function getLLMProvider(sink?: UsageSink): LLMProvider {
  const config = getConfig();
  switch (config.llmProvider) {
    case 'openai':
      return new OpenAIProvider(sink);
    case 'nvidia':
      return new OpenAICompatibleProvider(
        {
          name: 'NVIDIA NIM',
          baseUrl: config.NVIDIA_BASE_URL,
          apiKey: config.NVIDIA_API_KEY ?? '',
          modelFast: config.activeModelFast,
          modelMain: config.activeModelMain,
          structuredOutput: 'json_object',
        },
        sink,
      );
    case 'compatible':
      return new OpenAICompatibleProvider(
        {
          name: 'OpenAI-kompatibel',
          baseUrl: config.LLM_BASE_URL ?? '',
          apiKey: config.LLM_API_KEY ?? '',
          modelFast: config.activeModelFast,
          modelMain: config.activeModelMain,
          structuredOutput: 'json_schema',
        },
        sink,
      );
    default:
      // Kein Anbieter konfiguriert: Die Anwendung erfindet nichts, sie verlangt eine Einrichtung.
      throw new AppErrorException(
        appError('LLM_NOT_CONFIGURED', 'kein LLM-Anbieter konfiguriert', {
          retryable: false,
          userMessage:
            'Es ist kein Sprachmodell konfiguriert. Hinterlege einen Schlüssel mit „npm run set-key" und starte die App neu.',
        }),
      );
  }
}

export * from './provider';
export { renderInput } from './render';
export { OpenAIProvider } from './openai';
export { OpenAICompatibleProvider } from './openai-compatible';
