---
title: "ADR 001 — AI CLI governed research rewrite for Insight Agent"
status: accepted
date: 2026-09-09
product: insight-agent
---

# ADR 001 — AI CLI governed research rewrite for Insight Agent

## Context

Insight Agent MVP research (specs 19–28) works but open V1/V2 capabilities remain. Delivery must scale via AI CLI (tickets, features, workunits, PM budget ≤10 chats) without ad-hoc chat-only coding.

## Decision

1. Treat `PROJECT.md` as the product SSOT; bind specs under `specs/` remain technical authority.
2. Materialize AI CLI governance under `.cursor/` (brain, adr, prompts, specs workunits, testing SSOT).
3. Rank **100 features** via `ai features` from `ai tickets` scan; ship via `ai workunit launch` + `ai pm maintain --target 10 --for 5m`.
4. Enhance research in place (basic copy → enhance): query generation, multi-provider search, excerpt verification, conflict detection, RAG/doc retrieval hooks, eval fixtures — no demo/simulation paths.
5. Platform peer (`:4100`) is optional; local PM + coding CLIs (`agent` / `cursor-agent` / `claude`) are the execution path when platform ensure is unavailable.

## Consequences

- Agents work from ticket capsules; Telegram may receive finish/ADR posts when enabled.
- Test coverage checklist must update with every source change.
- Research quality gates (FR-24-08, excerpt verify, budgets) stay non-negotiable.

## Alternatives considered

- Pure Next.js rewrite without AI CLI — rejected (no governed ticket/feature swarm).
- Full platform dependency before coding — rejected (ensure script missing on this host; PM works locally).

## Follow-up (2026-09-09)

Delivered IAAR-0101/0201/0301: gap helper extract, query diversity, auto search failover. Workunit tickets marked `done`.
