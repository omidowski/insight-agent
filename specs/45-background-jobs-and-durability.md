---
id: 45-background-jobs-and-durability
title: Background Jobs & Durability
phase: 8
milestone: V1
status: draft
depends_on: [17-agent-state-management]
provides: [durable_runs]
complexity: L
---

# Background Jobs & Durability

> Kurzform-Spec (V1/V2). Vor der Implementierung ins Vollformat aus `PROMPT-1` überführen.

## Purpose
Macht Runs neustartfest und fortsetzbar, statt sie im Serverprozess zu halten (ersetzt ADR-006).

## Functional Requirements
- `FR-45-01` Runs MÜSSEN in eine Warteschlange gestellt und von einem Worker ausgeführt werden.
- `FR-45-02` Nach einem Neustart MÜSSEN unterbrochene Runs ab dem letzten abgeschlossenen Schritt fortgesetzt werden.
- `FR-45-03` Jeder Schritt MUSS idempotent wiederholbar sein (keine doppelten Quellen oder Nachrichten).
- `FR-45-04` Runs MÜSSEN pausierbar und fortsetzbar sein.
- `FR-45-05` Ein Run, der dreimal scheitert, MUSS endgültig als `failed` markiert werden.

## Acceptance Criteria
- `AC-45-01` Given Neustart nach Schritt 2, Then wird ab Schritt 3 fortgesetzt und keine Quelle doppelt gespeichert.
- `AC-45-02` Given „Pause", Then stoppt der Run und lässt sich fortsetzen.

## Dependencies
17.
