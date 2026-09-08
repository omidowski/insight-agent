/** Anbieterunabhängige Suche (Spec 19, FR-19-01). */
import type { SearchHit } from '@/lib/contracts/domain';

export interface SearchOptions {
  maxResults: number;
  signal?: AbortSignal;
}

export interface SearchProvider {
  readonly name: string;
  search(query: string, opts: SearchOptions): Promise<SearchHit[]>;
}
