---
id: 17-agent-state-management
title: Agent State Management
phase: 3
milestone: MVP
status: done
depends_on: [04-data-model-and-database, 05-shared-contracts]
provides: [run_state]
owner_modules: ["lib/agent/state.ts"]
complexity: M
---

# Agent State Management

## Purpose
Hält den Zustand eines Runs vollständig persistent, damit Ausführung nachvollziehbar, abbrechbar und
auswertbar ist — auch nach einem Neustart.

## Scope / Out of Scope
In Scope: Statusmodell, Übergänge, Persistenz, Abbruch, Wiederaufnahme-Semantik.
Out of Scope: Planinhalt (Spec 15), Ereignisdarstellung (Spec 30).

## User Story
„Als Nutzer möchte ich einen Run abbrechen können und danach trotzdem das Zwischenergebnis sehen."

## Functional Requirements
- `FR-17-01` Der Run-State MUSS nach jedem Schritt persistiert werden, nicht erst am Ende.
- `FR-17-02` Statuswechsel MÜSSEN ausschließlich über `setStatus()` erfolgen und ein `status.changed`-Event erzeugen.
- `FR-17-03` Ungültige Übergänge MÜSSEN abgelehnt werden (`INTERNAL`).
- `FR-17-04` Abbruch MUSS persistent in `runs.cancel_requested` vermerkt werden UND über ein
  `AbortController`-Signal an alle laufenden Tool- und Modellaufrufe wirken (ADR-011).
- `FR-17-05` Beim Laden eines Runs mit Status `running`, dessen `updated_at` älter als 5 Minuten ist,
  MUSS er als `failed` (`code: INTERNAL`, Teilergebnis erhalten) dargestellt werden.
- `FR-17-06` Budgets MÜSSEN beim Start eingefroren und laufend fortgeschrieben werden.

## Expected Behavior
Erlaubte Übergänge:
```
idle → routing → {planning | synthesizing}
planning → searching → reading_sources → extracting → comparing → synthesizing
searching → searching (weitere Iteration)   comparing → searching (Nachrecherche)
* → cancelled | failed        synthesizing → completed
```
`RunState` im Speicher spiegelt die DB-Zeile plus `steps`, `sources`, `toolCalls`, `usage`.
`RunRegistry` (Map `runId → AbortController`) ist der schnelle In-Process-Pfad; zusätzlich prüft
`checkCancellation()` vor jedem Schritt und ein Watcher alle 250 ms das persistente Flag `runs.cancel_requested`.

## User Flow
Abbruch über „Stopp"; die UI zeigt danach `cancelled` und behält Teilergebnisse.

## System Flow
`createRunState()` → `setStatus()` → `recordStep()` → `finalize()`; jede Mutation schreibt in die DB und
emittiert bei Bedarf ein Event.

## Agent Behavior
Der Orchestrator liest Budgets ausschließlich aus dem State.

## Contracts
`RunState`, `RunStatus`, `RunBudgets` (Spec 05).

## API Requirements
`GET /api/runs/:id`, `POST /api/runs/:id/cancel` (Spec 08).

## Data Model
`runs`, `run_steps`, `tool_calls`, `usage_events`.

## UI Requirements
Statusanzeige in der Activity-Karte (Spec 30).

## States
Siehe oben.

## Telemetry & Events
`status.changed`, `budget.warning` bei ≥ 80 % Verbrauch, `run.cancelled`.

## Configuration
`RUN_STALE_AFTER_MS` (300000).

## Edge Cases
1. Abbruch vor dem ersten Schritt → Status `cancelled`, keine Assistant-Message.
2. Doppelter Abbruch → zweiter Aufruf ist wirkungslos (`409` an der API).
3. Abbruch während der Synthese → Teiltext wird gespeichert und als abgebrochen markiert.
4. Prozessneustart → verwaister Run wird beim Lesen als `failed` dargestellt (nicht in der DB umgeschrieben).
5. Budgetüberschreitung → `BUDGET_EXCEEDED`, Übergang nach `synthesizing` statt `failed`.
6. Schrittfehler → Schritt `failed`, Run läuft mit den übrigen Schritten weiter.

## Error Handling
Fehler werden in `runs.error_json` als `AppError` abgelegt.

## Security Considerations
`error_json` enthält keine Rohprompts und keine Secrets.

## Performance Budget
Statuspersistenz ≤ 5 ms; kein Schreibvorgang häufiger als 20/s je Run (Deltas werden gepuffert).

## Test Plan
`tests/unit/run-state.test.ts`: Übergangsmatrix, Abbruchweitergabe, Stale-Erkennung, Budgetfortschreibung.

## Acceptance Criteria
- `AC-17-01` Given Status `completed`, When `setStatus('searching')`, Then Fehler. (FR-17-03)
- `AC-17-02` Given laufender Run, When Abbruch, Then erhalten alle laufenden Aufrufe `abort` und der Status ist `cancelled`. (FR-17-04)
- `AC-17-03` Given `running` und `updated_at` vor 10 Minuten, When gelesen, Then erscheint `failed` mit Teilergebnis. (FR-17-05)
- `AC-17-04` Given jeder Schritt, Then existiert eine persistierte Zeile in `run_steps`. (FR-17-01)

## Definition of Done
State-Tests grün; keine direkte Statusmutation außerhalb `state.ts`.

## Dependencies
04, 05.

## Implementation Notes
Übergangsmatrix als konstantes Objekt; `assertTransition()` wirft bei Verstoß.

## Open Decisions
Echte Wiederaufnahme siehe Spec 45 (V1).
