---
id: 15-agent-planning
title: Agent Planning
phase: 3
milestone: MVP
status: done
depends_on: [14-agent-orchestrator, 07-prompt-management]
provides: [plan]
owner_modules: ["lib/agent/planner.ts"]
complexity: M
---

# Agent Planning

## Purpose
Zerlegt eine Aufgabe in beantwortbare Teilfragen mit Reihenfolge und Abhängigkeiten — Grundlage für
Recherche, Fortschrittsanzeige und Vollständigkeitsprüfung.

## Scope / Out of Scope
In Scope: Planerzeugung, Replanning, Validierung des Plans.
Out of Scope: Ausführung der Schritte (Spec 16).

## User Story
„Als Nutzer möchte ich sehen, welche Teilfragen der Agent beantworten will."

## Functional Requirements
- `FR-15-01` Der Plan MUSS per Structured Output als Liste von Schritten entstehen (`title`, `question`, `dependsOn`).
- `FR-15-02` Ein Plan MUSS 2–8 Schritte haben; mehr wird gekürzt, weniger wird aufgefüllt.
- `FR-15-03` Abhängigkeiten MÜSSEN zyklenfrei sein; Zyklen werden aufgelöst, indem der spätere Schritt entkoppelt wird.
- `FR-15-04` Schritte MÜSSEN persistiert werden (`run_steps`) und ein `plan.created`-Event erzeugen.
- `FR-15-05` Replanning MUSS möglich sein, maximal 2-mal je Run, jeweils mit `plan.updated` und Begründung.
- `FR-15-06` Jeder Schritt MUSS eine eigenständig beantwortbare Frage enthalten (keine Verweise wie „siehe oben").

## Expected Behavior
Beispiel „Vergleiche die 5 wertvollsten europäischen Fußballvereine nach Umsatz, Kaderwert und
Social-Media-Reichweite und erstelle eine Tabelle":
1. Welche fünf europäischen Vereine haben aktuell den höchsten Marktwert?
2. Wie hoch ist der Jahresumsatz je Verein (aktuelle Saison)?
3. Wie hoch ist der Kaderwert je Verein?
4. Wie groß ist die Social-Media-Reichweite je Verein?
5. Welche Werte widersprechen sich zwischen den Quellen? (dependsOn 2,3,4)

Schritte ohne Abhängigkeit sind parallelisierbar (Spec 16).

## User Flow
Der Plan erscheint als Liste in der Activity-Karte; erledigte Schritte werden abgehakt.

## System Flow
`plan(request, taskType, context)` → `Plan` → Persistenz → Event.

## Agent Behavior
Der Planer kennt keine Suchergebnisse; er plant ausschließlich aus der Anfrage und dem Konversationskontext.

## Contracts
`PlanStep { id, seq, title, question, dependsOn: string[], status, result? }`.

## API Requirements
Keine.

## Data Model
`run_steps`, `runs.plan_json`.

## UI Requirements
Schrittliste mit Status-Icons (Spec 30).

## States
Schritt: `pending` · `running` · `completed` · `failed` · `skipped`.

## Telemetry & Events
`plan.created`, `plan.updated`.

## Configuration
`MAX_PLAN_STEPS` (8), `MAX_REPLANS` (2).

## Edge Cases
1. Einfache Frage → Plan mit genau 2 Schritten (Recherche, Prüfung).
2. Modell liefert 15 Schritte → auf 8 gekürzt, Rest verworfen.
3. Modell liefert 0 Schritte → Fallback: ein Schritt mit der Originalfrage.
4. Zyklische Abhängigkeit → Kante entfernt, Log-Eintrag.
5. Schritt ohne Frage → wird verworfen.
6. Replanning-Limit erreicht → weiter mit vorhandenem Plan.

## Error Handling
`LLM_BAD_OUTPUT` → Fallback-Plan aus der Originalfrage; der Run läuft weiter.

## Security Considerations
Der Planer verarbeitet keinen Webinhalt und ist damit kein Injektionsziel.

## Performance Budget
≤ 4 s.

## Test Plan
`tests/unit/planner.test.ts`: Schrittzahlgrenzen, Zyklusauflösung, Fallback, Persistenz, Replanning-Limit.

## Acceptance Criteria
- `AC-15-01` Given eine Vergleichsanfrage, Then entstehen 2–8 Schritte mit eigenständigen Fragen. (FR-15-02, FR-15-06)
- `AC-15-02` Given ein Modellplan mit Zyklus, Then ist der gespeicherte Plan zyklenfrei. (FR-15-03)
- `AC-15-03` Given ein leerer Modellplan, Then existiert ein Fallback-Schritt. (Edge 3)
- `AC-15-04` Given ein dritter Replanning-Versuch, Then wird er abgelehnt. (FR-15-05)

## Definition of Done
Planer-Tests grün; Plan erscheint korrekt in der UI.

## Dependencies
07, 14.

## Implementation Notes
Topologische Sortierung mit Zykluserkennung in `lib/util/graph.ts` (auch für den Spec-Graph nutzbar).

## Open Decisions
Keine.
