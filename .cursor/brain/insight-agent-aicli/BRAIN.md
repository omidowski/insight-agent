---
title: Insight Agent × AI CLI brain
status: active
created: 2026-09-09
---

# BRAIN — insight-agent-aicli

## Goal

Rewrite and enhance Insight Agent research capabilities using AI CLI as the delivery control plane: tickets → features (100) → workunit → 10 parallel coding agents for a 5-minute maintain window, then continue via queue.

## Tickets

- [[TICKETS]] — scan pool (SCAN-*)
- [[FEATURES]] — ranked top 100 (FEAT-*)
- [[ANALYSIS]] — project picture + control scan

## Priority themes (infer from specs + README open items)

1. **Research quality** — query diversity, multi-source corroboration, saturation, gap reporting
2. **AI CLI wiring** — PROJECT.md SSOT, `.ai/` knowledge/RAG, workunit capsules, PM maintain
3. **Retrieval upgrade** — document upload + file search (spec 22/32), purpose-scoped RAG via `ai rag`
4. **Deep research UX** — activity feed fidelity, sources panel, conflict clarity
5. **Provider resilience** — Brave/Tavily/OpenAI search failover, model catalog health
6. **Eval harness** — spec 41; regression fixtures for citation integrity
7. **Durability** — background jobs (spec 45), cancel/resume hardening
8. **Safety** — injection/SSRF regression tests; budget telemetry
9. **Export/report** — report generation (spec 29), sharing (spec 46)
10. **Auth foundation** — local-user → optional AUTH_ENABLED (spec 34/35)

## Delivery rule

No questions. Basic-copy existing MVP research path, then enhance in place. Prefer small TDD slices per ticket capsule. Agents must not invent sources.

## Launch

Prompt: `.cursor/prompts/INSIGHT-AGENT-AICLI-RESEARCH-REWRITE.md`
