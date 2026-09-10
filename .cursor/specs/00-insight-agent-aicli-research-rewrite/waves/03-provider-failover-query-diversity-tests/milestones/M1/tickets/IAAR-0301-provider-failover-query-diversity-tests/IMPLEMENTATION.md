# Implementation — IAAR-0301

- `lib/search/failover.ts` — `FailoverSearchProvider` + `buildFailoverChain` (openai → brave → tavily)
- `lib/search/index.ts` — `SEARCH_PROVIDER=auto` uses failover chain
- `lib/agent/research/query-diversity.ts` — normalize / near-duplicate / diversify
- Wired into `generateQueries` in `lib/agent/research/engine.ts`
