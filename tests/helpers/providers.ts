import { FakeLLMProvider } from '../doubles/fake-llm';
import { FakeSearchProvider } from '../doubles/fake-search';
import type { LLMProvider } from '@/lib/llm/provider';
import type { SearchProvider } from '@/lib/search/provider';

export function fakeLlm(): LLMProvider {
  return new FakeLLMProvider();
}

export function fakeSearch(origin: string): SearchProvider {
  return new FakeSearchProvider(origin);
}
