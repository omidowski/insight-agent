---
id: 16-task-execution
title: Task Execution
phase: 3
milestone: MVP
status: done
depends_on: [15-agent-planning, 18-tool-system-core]
provides: [step_execution]
owner_modules: ["lib/agent/task-execution.ts"]
complexity: L
---

# Task Execution

## Purpose
Arbeitet die Planschritte ab: Reihenfolge, begrenzte Parallelität, Teilergebnisse, Fehlertoleranz.

## Scope / Out of Scope
In Scope: Scheduling, Nebenläufigkeit, Ergebnisaggregation, Teilfehler.
Out of Scope: Recherchelogik je Schritt (Spec 24).

## User Story
„Als Nutzer möchte ich, dass eine mehrteilige Aufgabe vollständig abgearbeitet wird, auch wenn ein Teil scheitert."

## Functional Requirements
- `FR-16-01` Schritte MÜSSEN in topologischer Reihenfolge ausgeführt werden.
- `FR-16-02` Unabhängige Schritte MÜSSEN parallel laufen, begrenzt auf `STEP_CONCURRENCY` (Default 3).
- `FR-16-03` Jeder Schritt MUSS `step.started`/`step.completed` erzeugen und sein Ergebnis persistieren.
- `FR-16-04` Ein fehlgeschlagener Schritt DARF abhängige Schritte nur überspringen, nicht den Run beenden.
- `FR-16-05` Ergebnisse MÜSSEN als strukturierte `StepResult` mit Quellenbezug vorliegen.
- `FR-16-06` Bei Budgetüberschreitung MÜSSEN offene Schritte als `skipped` markiert werden.

## Expected Behavior
`StepResult { stepId, answer: string, sourceIds: string[], values?: Record<string,string>, confidence: number }`.
Der Executor prüft vor jedem Schritt Abbruchsignal und Budget.

## User Flow
Fortschritt sichtbar als Häkchen je Schritt in der Activity-Karte.

## System Flow
`executeSteps(plan, ctx)` → Warteschlange nach Abhängigkeiten → `researchStep()` je Schritt →
Aggregation in `RunState`.

## Agent Behavior
Je Schritt entscheidet das Modell über Suchanfragen und Quellenauswahl innerhalb der Restbudgets.

## Contracts
`StepResult` (siehe oben), `PlanStep` (Spec 15).

## API Requirements
Keine.

## Data Model
`run_steps.result_json`.

## UI Requirements
Schrittstatus und Kurzergebnis (Spec 30).

## States
Siehe `StepStatus`.

## Telemetry & Events
`step.started`, `step.completed`; Metrik: Dauer je Schritt.

## Configuration
`STEP_CONCURRENCY` (3).

## Edge Cases
1. Alle Schritte scheitern → Synthese mit ehrlicher Negativantwort.
2. Ein Schritt liefert widersprüchliche Werte → an Spec 28 weitergereicht.
3. Abbruch während paralleler Schritte → alle laufenden Aufrufe erhalten `abort`.
4. Abhängiger Schritt, dessen Vorgänger fehlschlug → `skipped` mit Begründung.
5. Schritt läuft länger als das Restzeitbudget → wird abgebrochen und als `failed` markiert.
6. Doppelte Suchanfragen über Schritte hinweg → Dedup über den Run-Cache (Spec 18).

## Error Handling
Schrittfehler werden im `StepResult` festgehalten und in der Synthese als Lücke ausgewiesen.

## Security Considerations
Parallelität erhöht die Last auf Zielseiten — das Domain-Ratelimit aus Spec 36 gilt auch hier.

## Performance Budget
Overhead des Schedulers ≤ 10 ms; Gesamtlaufzeit innerhalb des Run-Zeitbudgets.

## Test Plan
`tests/unit/task-execution.test.ts`: topologische Reihenfolge, Parallelitätsgrenze, Skip-Kaskade,
Abbruch, Budgetstopp.

## Acceptance Criteria
- `AC-16-01` Given ein Plan mit 3 unabhängigen Schritten und Limit 3, Then laufen sie gleichzeitig. (FR-16-02)
- `AC-16-02` Given einen fehlgeschlagenen Vorgänger, Then ist der abhängige Schritt `skipped`. (FR-16-04)
- `AC-16-03` Given Abbruch, Then endet die Ausführung in ≤ 500 ms. (Edge 3)
- `AC-16-04` Given Budgetende, Then sind offene Schritte `skipped` und die Synthese startet. (FR-16-06)

## Definition of Done
Tests grün; Parallelität nachweislich begrenzt.

## Dependencies
15, 18, 24.

## Implementation Notes
Eigener kleiner Semaphor in `lib/util/concurrency.ts`; keine externe Bibliothek.

## Open Decisions
Keine.
