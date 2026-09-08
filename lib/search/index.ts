import { getConfig } from '@/lib/config/env';
import type { SearchProvider } from './provider';
import { BraveSearchProvider, OpenAISearchProvider, TavilySearchProvider } from './providers';
import { appError, AppErrorException } from '@/lib/util/errors';

/** Ist überhaupt eine Websuche verfügbar? (Spec 19, ADR-013) */
export function hasSearchProvider(): boolean {
  const config = getConfig();
  if (config.SEARCH_PROVIDER === 'brave') return Boolean(config.BRAVE_API_KEY);
  if (config.SEARCH_PROVIDER === 'tavily') return Boolean(config.TAVILY_API_KEY);
  if (config.SEARCH_PROVIDER === 'openai') return config.llmProvider === 'openai';
  return Boolean(config.BRAVE_API_KEY) || Boolean(config.TAVILY_API_KEY) || config.llmProvider === 'openai';
}

export function getSearchProvider(): SearchProvider {
  const config = getConfig();
  switch (config.SEARCH_PROVIDER) {
    case 'brave':
      return new BraveSearchProvider();
    case 'tavily':
      return new TavilySearchProvider();
    case 'openai':
      return new OpenAISearchProvider();
    default:
      if (config.BRAVE_API_KEY) return new BraveSearchProvider();
      if (config.TAVILY_API_KEY) return new TavilySearchProvider();
      // Die gehostete Websuche gibt es nur bei OpenAI.
      if (config.llmProvider === 'openai') return new OpenAISearchProvider();
      throw new AppErrorException(
        appError('SEARCH_NOT_CONFIGURED', 'kein Suchanbieter konfiguriert', {
          retryable: false,
          userMessage:
            'Für die Websuche fehlt ein Anbieter. Hinterlege BRAVE_API_KEY oder TAVILY_API_KEY in .env.local.',
        }),
      );
  }
}

export * from './provider';
