---
title: "Insight Agent — AI CLI research rewrite + enhance"
tags:
  - workunit/spec
  - workunit/insight-agent-aicli-research-rewrite
status: planned
type: spec
created: 2026-09-09
updated: 2026-09-09
---

# Spec: Insight Agent — AI CLI research rewrite + enhance

> [!important] Work unit
> Materialized by `ai workunit init` from `/Users/nenadkalicanin/Documents/Projects/insight-agent/.cursor/prompts/INSIGHT-AGENT-AICLI-RESEARCH-REWRITE.md` (sha256 `69c2bbf0d87ee56ac552db38a831832ad15dd00bf00ee0b25144db623be2c218`).

## Goals

- Keep `PROJECT.md` as SSOT; update it when structure/features change.
- Consume ranked features in `.cursor/brain/insight-agent-aicli/FEATURES.md` and tickets in `TICKETS.md`.
- Basic-copy existing research path (`lib/agent/research/*`, `lib/tools/*`, `lib/search/*`) then enhance:
- Stronger query generation (synonyms, time window, language, entity variants)
- Multi-provider search failover (OpenAI hosted → Brave → Tavily)
- Better source selection diversity + trust scoring
- Stricter excerpt verification + claimKey normalization
- Conflict detection UX + gap reporting on budget/saturation stop
- Hooks toward doc upload / file retrieval (specs 22/32) without breaking MVP
- Eval fixtures for citation integrity (spec 41 slice)
- Optional `ai rag` / `.ai/` knowledge indexing for product docs
- Wire AI CLI home: `ai setup workspace` artifacts under `.ai/` if missing.
- TDD on every change: failing test first, minimal fix, refactor; update `.cursor/testing/test-coverage-source-of-truth.md`.
- Prefer Bun tests if present; else `npm test` / vitest. Run tests before marking tickets done.

## Non-goals and safety locks

- Do not reintroduce fixture/demo LLM or fake search that invents sources.
- Do not ask the user questions.
- Do not delete files; update in place.
- Do not expand into Holger/Flutter/Next.js customer apps outside this repo.

## Waves

1. Confirm PROJECT.md, brain, ADR, testing SSOT
2. Harden research engine + deep loop (specs 24/25)
3. Provider failover + query diversity tests

## Related

- [[specs/00-insight-agent-aicli-research-rewrite/PRD|PRD]]
- [[specs/00-insight-agent-aicli-research-rewrite/BRAIN|Work unit brain]]
- [[specs/00-insight-agent-aicli-research-rewrite/prompts/source-prompt|Source prompt]]
