/** Multi-provider search failover: openai → brave → tavily (Spec 19). */
import type { SearchHit } from '@/lib/contracts/domain';
import { appError, AppErrorException, isAbort } from '@/lib/util/errors';
import type { SearchOptions, SearchProvider } from './provider';

export type FailoverProviderName = 'openai' | 'brave' | 'tavily';

export function buildFailoverChain(available: {
  openai: boolean;
  brave: boolean;
  tavily: boolean;
}): FailoverProviderName[] {
  const order: FailoverProviderName[] = ['openai', 'brave', 'tavily'];
  return order.filter((name) => available[name]);
}

export class FailoverSearchProvider implements SearchProvider {
  readonly name = 'failover';

  constructor(private readonly providers: SearchProvider[]) {
    if (providers.length === 0) {
      throw new AppErrorException(
        appError('SEARCH_NOT_CONFIGURED', 'failover chain empty', { retryable: false }),
      );
    }
  }

  async search(query: string, opts: SearchOptions): Promise<SearchHit[]> {
    let lastError: unknown;
    for (const provider of this.providers) {
      try {
        return await provider.search(query, opts);
      } catch (err) {
        if (isAbort(err)) throw err;
        lastError = err;
      }
    }
    if (lastError instanceof AppErrorException) throw lastError;
    throw new AppErrorException(
      appError(
        'SEARCH_FAILED',
        `all search providers failed: ${(lastError as Error)?.message?.slice(0, 200) ?? 'unknown'}`,
      ),
    );
  }
}
