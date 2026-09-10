---
title: Provider routing — agent / Codex / Claude
aliases: []
tags: [aicli/setup]
status: active
type: llm-rule
product: ai
created: 2026-09-09
updated: 2026-09-09
---

# Provider routing (agent · Codex · Claude)

Seeded by `ai setup workspace`. Applies to all local `ai` / swarm / console runs that pick a coding CLI.

## Default routing

| Job class | Use | Why |
|---|---|---|
| Easy / short / mechanical | **Cursor agent CLI** | Fast, cheap, good enough for small edits and checks |
| Normal tasks / implementation slices | **Codex** | Stronger task execution while contingent remains |
| Thinking / architecture / big problems | **Claude** | Deep reasoning for hard design and large refactors |

## Contingent exhaustion (mandatory)

1. **Prefer paid contingent first:** consume **Claude** and **Codex** quota/contingent until exhausted for eligible work (Claude for hard/thinking jobs; Codex for ordinary tasks).
2. **Do not hop early** to free/agent-only when Claude or Codex still have remaining contingent for that job class.
3. **When Claude and Codex contingents are both used up**, switch **fully to agent** (Cursor agent CLI) for all remaining jobs until contingent resets.
4. Track exhaustion from CLI/provider errors or usage badges; once both are spent, set routing mode to **agent-only** for the rest of the window.

## Gemini

Enable **Gemini CLI** with **Sign in with Google** (Google AI Pro). Prefer account `njoco@hotmail.de`. Do **not** use `GEMINI_API_KEY` / `GOOGLE_API_KEY` for Pro quota — OAuth login owns the Pro contingent.

## Enforcement

- PM / marketplace packs and `ai setup` may cite this file.
- Swarm workers: pick backend per table above; after dual exhaustion, `--cursor` / agent only.
