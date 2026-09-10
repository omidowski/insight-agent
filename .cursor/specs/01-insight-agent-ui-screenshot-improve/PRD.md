---
title: "PRD — Insight Agent — UI screenshot improve + ship"
tags:
  - workunit/prd
  - workunit/insight-agent-ui-screenshot-improve
status: planned
type: prd
created: 2026-09-09
updated: 2026-09-09
---

# PRD — Insight Agent — UI screenshot improve + ship

## Problem

_Describe the problem this work unit solves. Seeded from the source prompt; refine during planning._

## Requirements (from prompt goals)

1. Rewrite `app/globals.css`, `app/layout.tsx` (fonts), `components/ChatApp.tsx`, Sidebar, ActivityCard, SourcesPanel for the new look
2. Keep all behavior/API contracts; TDD for any logic changes
3. Update `.cursor/testing/test-coverage-source-of-truth.md` and PROJECT.md
4. Store screenshots + annotated PNGs under `.cursor/design/insight-ui/`
5. Prefer update over delete

## Out of scope

- _To be completed during planning._

## Delivery shape

1 waves, each with milestone M1 and seed ticket capsules under `waves/<nn>-<slug>/milestones/M1/tickets/`.

## Related

- [[specs/01-insight-agent-ui-screenshot-improve/SPEC|Spec]]
- [[specs/01-insight-agent-ui-screenshot-improve/BRAIN|Work unit brain]]
