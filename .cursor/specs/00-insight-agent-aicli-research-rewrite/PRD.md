---
title: "PRD — Insight Agent — AI CLI research rewrite + enhance"
tags:
  - workunit/prd
  - workunit/insight-agent-aicli-research-rewrite
status: planned
type: prd
created: 2026-09-09
updated: 2026-09-09
---

# PRD — Insight Agent — AI CLI research rewrite + enhance

## Problem

_Describe the problem this work unit solves. Seeded from the source prompt; refine during planning._

## Requirements (from prompt goals)

1. Keep `PROJECT.md` as SSOT; update it when structure/features change.
2. Consume ranked features in `.cursor/brain/insight-agent-aicli/FEATURES.md` and tickets in `TICKETS.md`.
3. Basic-copy existing research path (`lib/agent/research/*`, `lib/tools/*`, `lib/search/*`) then enhance:
4. Stronger query generation (synonyms, time window, language, entity variants)
5. Multi-provider search failover (OpenAI hosted → Brave → Tavily)
6. Better source selection diversity + trust scoring
7. Stricter excerpt verification + claimKey normalization
8. Conflict detection UX + gap reporting on budget/saturation stop
9. Hooks toward doc upload / file retrieval (specs 22/32) without breaking MVP
10. Eval fixtures for citation integrity (spec 41 slice)
11. Optional `ai rag` / `.ai/` knowledge indexing for product docs
12. Wire AI CLI home: `ai setup workspace` artifacts under `.ai/` if missing.
13. TDD on every change: failing test first, minimal fix, refactor; update `.cursor/testing/test-coverage-source-of-truth.md`.
14. Prefer Bun tests if present; else `npm test` / vitest. Run tests before marking tickets done.

## Out of scope

- Do not reintroduce fixture/demo LLM or fake search that invents sources.
- Do not ask the user questions.
- Do not delete files; update in place.
- Do not expand into Holger/Flutter/Next.js customer apps outside this repo.

## Delivery shape

3 waves, each with milestone M1 and seed ticket capsules under `waves/<nn>-<slug>/milestones/M1/tickets/`.

## Related

- [[specs/00-insight-agent-aicli-research-rewrite/SPEC|Spec]]
- [[specs/00-insight-agent-aicli-research-rewrite/BRAIN|Work unit brain]]
