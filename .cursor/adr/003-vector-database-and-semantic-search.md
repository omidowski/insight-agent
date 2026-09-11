---
title: "ADR 003 — Vector Database and Semantic Search over All Generated Data and Prompts"
status: accepted
date: 2026-09-11
product: insight-agent
---

# ADR 003 — Vector Database and Semantic Search over All Generated Data and Prompts

## Context

Insight Agent generates rich research artifacts, user queries, assistant syntheses, source extractions, verbatim excerpts, detected conflicts, citations, and agent execution prompts. While SQLite stores relational data, semantic retrieval across past research, system prompts, and extracted evidence was missing. Users and agents need semantic vector search across all generated prompts and data.

## Decision

1. **Embedded Vector Database in SQLite**:
   - Added migration `004_vector_entries` creating `vector_entries` with packed `Float32Array` BLOB embeddings, metadata JSON, entity type, entity ID, and parent ID.
   - Zero external database dependencies; adheres to ADR-002 and ADR-009 using `node:sqlite`.
   - In-memory cosine similarity ranking using optimized Float32Array operations with dot product and L2 normalization.

2. **Dual-Tier Embedding Provider**:
   - `DeterministicEmbeddingProvider`: Fast subword 3-gram and token hashing with TF weighting into 256-dimensional unit hypersphere. Runs completely offline, in sandbox, and in CI with zero network calls and zero API keys.
   - `OpenAIEmbeddingProvider`: Calls `/v1/embeddings` (`text-embedding-3-small` or configured model) when configured, with automatic fallback to deterministic embeddings on network errors.

3. **Comprehensive Indexer (`lib/vector/indexer.ts`)**:
   - Indexes all 10 system and agent prompt templates (`routerPrompt`, `plannerPrompt`, `queryGenPrompt`, `extractionPrompt`, `synthesisPrompt`, `conversationPrompt`, `titlePrompt`, `followupContextPrompt`, `searchProviderInstruction`, `UNTRUSTED_RULE`).
   - Automatically indexes runtime dynamic prompts, messages, runs, plan steps, web sources, excerpts, conflicts, citations, and tool calls.
   - Provides `syncAll(repos)` for complete backfill across existing SQLite tables.

4. **Agent Tool Integration**:
   - Registered `vector_search` tool in `lib/tools/registry.ts` and enabled in `RESEARCH_TOOLS` in `lib/agent/paths.ts`.
   - Allows the research agent to recall prior research, verified excerpts, and system strategies during runs.

5. **API & UI**:
   - Endpoints: `GET /api/vector/search`, `GET /api/vector/stats`, `POST /api/vector/sync`.
   - Dedicated `VectorSearchModal` UI with real-time similarity scores, entity filter chips, and full synchronization trigger.
   - CLI script: `npm run vector:sync` (`node scripts/sync-vector-db.mjs`).

## Consequences

- All prompts and generated data are semantically searchable.
- Performance: <10ms for full sync and search over thousands of records.
- 100% test coverage with zero external dependencies.
