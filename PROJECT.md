---
title: Insight Agent — Product Source of Truth
aliases: [insight-agent SSOT, Insight Agent]
tags: [insight-agent/core, research-agent, aicli]
status: active
type: project
product: insight-agent
created: 2026-09-09
updated: 2026-09-09
home: /Users/nenadkalicanin/Documents/Projects/insight-agent
---

# Insight Agent — Product Source of Truth

Autonomous AI research agent web app: chat → route → plan → search → read → compare → cite.
Every factual claim must be traceable to a source. No simulated answers in production paths (ADR-013).

**UI (2026-09-09):** brand-first empty hero (Syne + IBM Plex Sans), cool ink/teal research theme (ADR-002). Local: `http://127.0.0.1:3000`.
**Runtime:** Prefer Hermes via `.env.local` (`LLM_PROVIDER=hermes`) when OpenAI/NVIDIA keys are absent — chat + search without fake answers.

## Mission

Ship a production-grade research agent that:

1. Detects when web research is required vs. plain chat.
2. Plans multi-step research with hard budgets.
3. Searches, opens, extracts, verifies excerpts, detects conflicts.
4. Streams live progress (SSE) with durable run state.
5. Integrates **AI CLI** as first-class control: tickets, features, workunits, PM swarms, RAG, memory.

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js 15 App Router, React 19, TypeScript |
| Agent | `lib/agent/` — router, planner, orchestrator, research loop |
| Tools | `lib/tools/` — registry, executor, web search/read |
| LLM | OpenAI + OpenAI-compatible (`LLM_BASE_URL`) |
| Search | OpenAI hosted web search, Brave, Tavily |
| DB | `node:sqlite` behind repositories + Vector DB (`lib/vector/`) |
| Specs | `specs/` (binding product specs) |
| AI CLI | `.cursor/` brain · tickets · features · workunits · ADRs |

## Layout

| Path | Role |
|------|------|
| `app/` | Next.js routes + API handlers |
| `components/` | Presentational UI |
| `lib/agent/` | Router, planner, orchestrator, research |
| `lib/tools/` | Tool registry + web tools |
| `lib/vector/` | Vector DB, cosine search, embeddings, indexer |
| `lib/llm/` `lib/search/` | Provider adapters |
| `lib/db/` | SQLite + repositories |
| `lib/contracts/` | Zod schemas, events, errors |
| `specs/` | Binding specifications (INDEX.md) |
| `tests/` | Vitest unit/integration + smoke |
| `.cursor/` | AI CLI brain, ADRs, prompts, specs, testing SSOT |

## Current state

- **MVP done**: chat, routing, research loop, citations, conflicts, SSE, cancel, model picker, dual providers, Vector DB over all prompts & data.
- **Open (V1/V2 per specs)**: auth, document upload/RAG, reports, code execution, durable jobs, export/share, eval harness.
- **Now**: rewrite/enhance research capabilities with AI CLI governance (100 features + ticket pool + PM agents).

## Non-negotiables

- No invented facts without sources (`FR-24-08`).
- Excerpt verification against source text.
- SSRF guard, injection isolation, budget hard-stops.
- TDD: failing test → minimal fix → refactor; update `.cursor/testing/test-coverage-source-of-truth.md`.
- `PROJECT.md` is the single source of truth for structure and product intent.

## AI CLI defaults

```bash
ai setup workspace /Users/nenadkalicanin/Documents/Projects/insight-agent --ensure
ai tickets -n 100 -P . --slug insight-agent-aicli
ai features -n 100 -P . --slug insight-agent-aicli --skip-scan
ai workunit launch .cursor/prompts/INSIGHT-AGENT-AICLI-RESEARCH-REWRITE.md -P . --ensure --target 10
ai pm maintain --for 5m --grace 1m --target 10 -P .
```

## Related docs

- Specs: `specs/INDEX.md`
- Decisions: `specs/DECISIONS.md`
- Brain: `.cursor/brain/insight-agent-aicli/BRAIN.md`
- ADR: `.cursor/adr/001-aicli-research-rewrite.md`
