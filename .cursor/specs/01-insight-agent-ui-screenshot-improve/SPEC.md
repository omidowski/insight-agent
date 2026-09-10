---
title: "Insight Agent — UI screenshot improve + ship"
tags:
  - workunit/spec
  - workunit/insight-agent-ui-screenshot-improve
status: planned
type: spec
created: 2026-09-09
updated: 2026-09-09
---

# Spec: Insight Agent — UI screenshot improve + ship

> [!important] Work unit
> Materialized by `ai workunit init` from `/Users/nenadkalicanin/Documents/Projects/insight-agent/.cursor/prompts/INSIGHT-AGENT-UI-SCREENSHOT-IMPROVE.md` (sha256 `e9858ec22371e94fc72fa1c5f5d5d494d5695eb005adde03f9594a4eec7131a1`).

## Goals

- Rewrite `app/globals.css`, `app/layout.tsx` (fonts), `components/ChatApp.tsx`, Sidebar, ActivityCard, SourcesPanel for the new look
- Keep all behavior/API contracts; TDD for any logic changes
- Update `.cursor/testing/test-coverage-source-of-truth.md` and PROJECT.md
- Store screenshots + annotated PNGs under `.cursor/design/insight-ui/`
- Prefer update over delete

## Non-goals and safety locks

- _To be completed during planning._

## Waves

1. Screenshot each surface; analyze; red-circle annotate regions

## Related

- [[specs/01-insight-agent-ui-screenshot-improve/PRD|PRD]]
- [[specs/01-insight-agent-ui-screenshot-improve/BRAIN|Work unit brain]]
- [[specs/01-insight-agent-ui-screenshot-improve/prompts/source-prompt|Source prompt]]
