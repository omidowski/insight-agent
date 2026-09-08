---
id: 35-authorization-and-ownership
title: Authorization & Ownership
phase: 8
milestone: V1
status: draft
depends_on: [34-authentication]
provides: [authz]
complexity: M
---

# Authorization & Ownership

> Kurzform-Spec (V1/V2). Vor der Implementierung ins Vollformat aus `PROMPT-1` überführen.

## Purpose
Stellt sicher, dass Nutzer nur eigene Conversations, Runs, Events und Quellen sehen.

## Functional Requirements
- `FR-35-01` Jede Leseoperation MUSS `user_id` prüfen; Fremdzugriff → `404` (kein `403`, um Existenz nicht preiszugeben).
- `FR-35-02` Der SSE-Stream MUSS dieselbe Prüfung durchführen.
- `FR-35-03` Prüfungen MÜSSEN in den Repositories erfolgen, nicht nur in den Handlern.
- `FR-35-04` Ein automatisierter Test MUSS jede Route auf Ownership prüfen.

## Acceptance Criteria
- `AC-35-01` Given Nutzer B und eine Conversation von A, Then liefert jeder Zugriff `404`.
- `AC-35-02` Given der Ownership-Test, Then ist keine Route ungeprüft.

## Dependencies
34.
