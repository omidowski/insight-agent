---
title: "ADR 002 — Insight Agent UI visual rewrite from screenshot review"
status: accepted
date: 2026-09-09
product: insight-agent
---

# ADR 002 — Insight Agent UI visual rewrite from screenshot review

## Context

Local empty-state screenshots showed a flat terracotta-on-stone AI-default look, weak brand hierarchy (nav-sized title), system fonts, and a setup banner competing with the hero.

## Decision

1. Retheme to a cool research aesthetic: deep ink + teal accent, atmospheric mesh gradient (not flat cream/terracotta).
2. Brand-first empty viewport: display font for **Insight Agent**, one headline, one sentence, one CTA group (examples), one dominant atmospheric plane.
3. Use `next/font` (Syne + IBM Plex Sans) — no Inter/Roboto/Arial/system stacks.
4. Capture/annotate via browser + `ai screenshot annotate` (localhost not on AI CLI capture allowlist).
5. Ship via workunit `insight-agent-ui-screenshot-improve` + local implement.

## Consequences

- Dark preference still supported with matching ink tokens.
- Behavior unchanged; honest unconfigured banner retained (ADR-013).
