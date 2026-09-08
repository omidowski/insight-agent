---
id: 25-deep-research-loop
title: Deep Research Loop
phase: 4
milestone: MVP
status: done
depends_on: [24-research-engine]
provides: [iterative_research]
owner_modules: ["lib/agent/research/loop.ts"]
complexity: L
---

# Deep Research Loop

## Purpose
Wiederholt die Recherche gezielt, solange relevante Lücken bestehen und Budget vorhanden ist —
und stoppt verlässlich, wenn nicht.

## Scope / Out of Scope
In Scope: Lückenanalyse, Folgeanfragen, Sättigungserkennung, Budgetdurchsetzung, Abbruchbedingungen.
Out of Scope: Einzelrecherche (Spec 24).

## User Story
„Als Nutzer möchte ich, dass der Agent nachrecherchiert, wenn die erste Runde nicht ausreicht — aber nicht endlos."

## Functional Requirements
- `FR-25-01` Nach jeder Iteration MUSS geprüft werden, welche Teilfragen unbeantwortet oder schwach belegt sind
  (< 2 unabhängige Quellen oder `confidence < 0.5`).
- `FR-25-02` Für Lücken MÜSSEN neue, andere Suchanfragen erzeugt werden (keine Wiederholung bisheriger Queries).
- `FR-25-03` Der Loop MUSS bei einer der folgenden Bedingungen enden: alle Fragen ausreichend belegt ·
  Budget erschöpft · keine neuen Informationen (Sättigung) · Abbruch durch den Nutzer.
- `FR-25-04` Sättigung liegt vor, wenn eine Iteration keine neue Quelle und keinen neuen `claimKey` liefert.
- `FR-25-05` Budgetgrenzen (`maxIterations`, `maxSearches`, `maxSources`, Zeit, Kosten) MÜSSEN hart durchgesetzt werden.
- `FR-25-06` Beim Beenden wegen Budget oder Sättigung MUSS die Antwort die verbleibenden Lücken ausweisen.

## Expected Behavior
```
iteration = 0
while true:
  führe offene Schritte aus (Spec 16/24)
  bewerte Lücken (FR-25-01)
  wenn keine Lücken oder Budget erschöpft oder Sättigung oder abgebrochen → break
  iteration++; wenn iteration >= maxIterations → break
  erzeuge Folgeschritte für Lücken (plan.updated)
```
Vor jeder Iteration wird `budget.warning` emittiert, wenn ≥ 80 % eines Budgets verbraucht sind.

## User Flow
Sichtbar als weitere Trace-Zeilen („Weitere Recherche gestartet — 2 offene Punkte").

## System Flow
`runResearchLoop(plan, ctx)` steuert Spec 16 und 24 und liefert alle Teilergebnisse an den Orchestrator.

## Agent Behavior
Folgeanfragen MÜSSEN sich messbar von den bisherigen unterscheiden (andere Begriffe, Synonyme,
Zeitraum, Sprache); identische Queries werden verworfen.

## Contracts
`LoopResult { iterations, stepResults, gaps: string[], stopReason }`
`stopReason: 'answered' | 'budget' | 'saturation' | 'cancelled'`.

## API Requirements / Data Model
Keine eigenen; nutzt `run_steps` und `runs.budgets_json`.

## UI Requirements
Iterationszähler und Stoppgrund in der Activity-Karte (Spec 30).

## States
`searching` ↔ `reading_sources` ↔ `extracting` ↔ `comparing`, danach `synthesizing`.

## Telemetry & Events
`plan.updated`, `budget.warning`; Metriken: Iterationen je Run, Verteilung der Stoppgründe.

## Configuration
`MAX_RESEARCH_ITERATIONS` (3), `MIN_SOURCES_PER_CLAIM` (2), `MIN_STEP_CONFIDENCE` (0.5).

## Edge Cases
1. Erste Iteration beantwortet alles → `stopReason = answered`, keine zweite Iteration.
2. Suche liefert dauerhaft dieselben Quellen → Sättigung nach der zweiten Iteration.
3. Zeitbudget läuft mitten in einer Iteration ab → laufende Schritte werden beendet, dann Synthese.
4. Nur eine Quelle je Kennzahl vorhanden → Lücke bleibt, wird in der Antwort benannt.
5. Nutzer bricht in Iteration 2 ab → `cancelled` mit Teilergebnissen.
6. Alle Folgeanfragen identisch zu früheren → Loop endet mit `saturation`.

## Error Handling
Fehler einzelner Iterationen beenden den Loop nicht; sie reduzieren die Abdeckung und erscheinen als Lücken.

## Security Considerations
Der Loop kann die Anzahl externer Abrufe vervielfachen — die Budgets sind zugleich Missbrauchsschutz.

## Performance Budget
Gesamt ≤ `maxWallClockMs`; Overhead der Loopsteuerung ≤ 20 ms je Iteration.

## Test Plan
`tests/unit/research-loop.test.ts`: alle vier Stoppgründe, Query-Diversität, Budgetdurchsetzung,
Lückenausweisung.

## Acceptance Criteria
- `AC-25-01` Given vollständige Belege nach Iteration 1, Then endet der Loop mit `answered`. (FR-25-03)
- `AC-25-02` Given eine Iteration ohne neue Quellen und `claimKeys`, Then endet der Loop mit `saturation`. (FR-25-04)
- `AC-25-03` Given `maxIterations = 3`, Then finden höchstens 3 Iterationen statt. (FR-25-05)
- `AC-25-04` Given ein Budgetstopp, Then enthält die Antwort einen Abschnitt „Offene Punkte". (FR-25-06)
- `AC-25-05` Given eine Lücke, Then unterscheidet sich die Folge-Query von allen bisherigen. (FR-25-02)

## Definition of Done
Loop-Tests grün; Stoppgründe im Trace sichtbar.

## Dependencies
16, 24.

## Implementation Notes
Bisherige Queries werden normalisiert in einem `Set` gehalten; Ähnlichkeitsprüfung über Token-Overlap > 0,9.

## Open Decisions
Keine.
