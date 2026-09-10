# Insight Agent — AI CLI research rewrite + enhance

## Intent

Finish AI CLI feature/ticket governance for **insight-agent**, then **rewrite/enhance research capabilities** as much as possible with AI CLI delivery. No questions. Infer from `PROJECT.md`, `specs/`, and `.cursor/brain/insight-agent-aicli/`.

## Goals

1. Keep `PROJECT.md` as SSOT; update it when structure/features change.
2. Consume ranked features in `.cursor/brain/insight-agent-aicli/FEATURES.md` and tickets in `TICKETS.md`.
3. Basic-copy existing research path (`lib/agent/research/*`, `lib/tools/*`, `lib/search/*`) then enhance:
   - Stronger query generation (synonyms, time window, language, entity variants)
   - Multi-provider search failover (OpenAI hosted → Brave → Tavily)
   - Better source selection diversity + trust scoring
   - Stricter excerpt verification + claimKey normalization
   - Conflict detection UX + gap reporting on budget/saturation stop
   - Hooks toward doc upload / file retrieval (specs 22/32) without breaking MVP
   - Eval fixtures for citation integrity (spec 41 slice)
   - Optional `ai rag` / `.ai/` knowledge indexing for product docs
4. Wire AI CLI home: `ai setup workspace` artifacts under `.ai/` if missing.
5. TDD on every change: failing test first, minimal fix, refactor; update `.cursor/testing/test-coverage-source-of-truth.md`.
6. Prefer Bun tests if present; else `npm test` / vitest. Run tests before marking tickets done.

## Non-goals

- Do not reintroduce fixture/demo LLM or fake search that invents sources.
- Do not ask the user questions.
- Do not delete files; update in place.
- Do not expand into Holger/Flutter/Next.js customer apps outside this repo.

## Waves

### Wave 1 — Governance + research core harden
- Confirm PROJECT.md, brain, ADR, testing SSOT
- Harden research engine + deep loop (specs 24/25)
- Provider failover + query diversity tests

### Wave 2 — Retrieval + citations + conflicts
- Source management / citation / conflict improvements (26–28)
- Activity/sources UI fidelity for new events

### Wave 3 — AI CLI surface + eval
- `.ai/` knowledge + RAG seeds from PROJECT.md/specs
- Eval harness starter + coverage checklist sync
- Document remaining V1 tickets as capsules, not TODOs in code

## Phases

1. Specify — align ticket capsules with FEATURES.md top items
2. Implement — TDD slices in `lib/` + tests
3. Verify — `npm test` (or bun), typecheck; fix regressions
4. Release — update IMPLEMENTATION notes under `.cursor/` evidence; newest ADR excerpt if material

## Constraints

- Host PM budget: **10** parallel chats; team size ≤3 per swarm.
- Maintain window requested: **5 minutes** active fill; keep shipping via queue after.
- Coding CLIs: prefer `agent` / `cursor-agent` / `claude` (codex may be unauthenticated).

## Definition of done (per agent)

- Ticket capsule status advanced with evidence
- Tests added/updated for touched files
- Coverage checklist updated
- No invented citations; FR-24-08 respected
