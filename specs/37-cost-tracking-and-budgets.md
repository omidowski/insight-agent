---
id: 37-cost-tracking-and-budgets
title: Cost Tracking & Budgets
phase: 6
milestone: MVP
status: done
depends_on: [06-openai-integration, 17-agent-state-management]
provides: [cost_control]
owner_modules: ["lib/agent/budget.ts", "lib/llm/pricing.ts"]
complexity: M
---

# Cost Tracking & Budgets

## Purpose
Macht die Kosten jedes Runs messbar und begrenzt sie hart, damit ein Research-Run nicht unbemerkt eskaliert.

## Scope / Out of Scope
In Scope: Usage-Erfassung, Preisberechnung, Budgetprüfung, Warnungen, Hardstop.
Out of Scope: Abrechnung je Nutzer (V2).

## User Story
„Als Betreiber möchte ich wissen, was ein Research-Run kostet, und ein Limit setzen können."

## Functional Requirements
- `FR-37-01` Jeder Modellaufruf MUSS Token und Kosten in `usage_events` schreiben.
- `FR-37-02` Kosten MÜSSEN in Mikro-USD ganzzahlig geführt werden.
- `FR-37-03` Vor jedem teuren Schritt MUSS das Restbudget geprüft werden.
- `FR-37-04` Bei ≥ 80 % Verbrauch MUSS `budget.warning` emittiert werden.
- `FR-37-05` Bei Überschreitung MUSS der Run mit dem vorhandenen Material antworten (kein harter Abbruch).
- `FR-37-06` Preise MÜSSEN konfigurierbar sein.

## Expected Behavior
`runs.cost_micro_usd` ist die Summe der `usage_events`. Budgets: Kosten, Zeit, Token, Iterationen,
Suchen, Quellen — jeweils mit `used/limit`. Zeit- und Kostenprüfung erfolgt vor jeder Iteration,
jedem Schritt und vor der Synthese; für die Synthese wird eine Reserve von 20 % vorgehalten.

## User Flow
Optionale Kostenanzeige in der Abschlusszusammenfassung (`SHOW_COSTS`).

## System Flow
`BudgetTracker` im `RunState`; `assertBudget(kind)` wirft `BUDGET_EXCEEDED`, das der Orchestrator
in einen Synthese-Übergang übersetzt.

## Agent Behavior
Der Agent weist im Ergebnis darauf hin, wenn wegen Budget vorzeitig beendet wurde.

## Contracts
`BudgetState { costMicroUsd, tokens, iterations, searches, sources, elapsedMs }` plus Limits.

## API Requirements
Kosten sind Teil von `GET /api/runs/:id`.

## Data Model
`usage_events`, `runs.cost_micro_usd`, `runs.usage_json`.

## UI Requirements
Zusammenfassungszeile in der Activity-Karte.

## States
Nicht zutreffend.

## Telemetry & Events
`budget.warning`, `run.completed.costMicroUsd`; Metrik: Kosten je Task-Typ.

## Configuration
`MAX_RUN_COST_USD`, `SHOW_COSTS`, `PRICING_JSON` (optional).

## Edge Cases
1. Anbieter liefert keine Usage → Schätzung, als `estimated` markiert.
2. Kostenlimit bereits vor der Synthese erreicht → Synthese läuft trotzdem mit der Reserve.
3. Anbieter ohne Preisangabe (kostenloses Kontingent) → Fallback-Preis, Kosten sind ein Richtwert.
4. Preisliste unbekanntes Modell → Fallback-Preis, Warnung im Log.
5. Sehr langer Run knapp unter Limit → `budget.warning` erscheint genau einmal je Budgetart.

## Error Handling
`BUDGET_EXCEEDED` ist kein Fehlerzustand für den Nutzer, sondern eine dokumentierte Begrenzung.

## Security Considerations
Kostenkontrolle ist Teil des Missbrauchsschutzes.

## Performance Budget
Buchung ≤ 1 ms.

## Test Plan
`tests/unit/budget.test.ts`: Summierung, Warnschwelle, Hardstop, Reserve für die Synthese, Schätzung.

## Acceptance Criteria
- `AC-37-01` Given drei Modellaufrufe, Then entspricht `runs.cost_micro_usd` der Summe der `usage_events`. (FR-37-01)
- `AC-37-02` Given 80 % Kostenverbrauch, Then erscheint genau ein `budget.warning`. (FR-37-04)
- `AC-37-03` Given Überschreitung während der Recherche, Then folgt eine Antwort mit Hinweis statt `run.failed`. (FR-37-05)
- `AC-37-04` Given fehlende Usage-Daten, Then wird geschätzt und markiert. (Edge 1)

## Definition of Done
Budget-Tests grün; Kosten im Run sichtbar.

## Dependencies
06, 17.

## Implementation Notes
Preise je 1M Token als Konstante; Mikro-USD vermeidet Fließkommafehler.

## Open Decisions
Siehe OPEN-QUESTIONS Nr. 4.
