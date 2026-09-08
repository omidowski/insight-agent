---
id: 14-agent-orchestrator
title: Agent Orchestrator
phase: 3
milestone: MVP
status: done
depends_on: [13-agent-request-router, 17-agent-state-management, 18-tool-system-core]
provides: [run_execution]
owner_modules: ["lib/agent/orchestrator.ts"]
complexity: XL
---

# Agent Orchestrator

## Purpose
Führt einen Run von der Nutzernachricht bis zur fertigen Antwort aus: Pfadwahl, Planung, Ausführung,
Synthese, Eventfluss, Budgets, Abbruch und Fehlerbehandlung. Einzige Stelle, die Statuswechsel vornimmt.

## Scope / Out of Scope
In Scope: Ablaufsteuerung, Eskalation, Endnachricht, Abschluss.
Out of Scope: Rechercheinterna (Spec 24/25), Toolinterna (Spec 18).

## User Story
„Als Nutzer möchte ich eine Antwort, die zum Aufwand meiner Frage passt."

## Functional Requirements
- `FR-14-01` `execute(runId)` MUSS den kompletten Lebenszyklus abwickeln und immer mit
  `run.completed`, `run.failed` oder `run.cancelled` enden.
- `FR-14-02` Für `conversation`/`knowledge_question` MUSS direkt gestreamt werden, ohne Tools und ohne Plan.
- `FR-14-03` Für Research-Pfade MUSS die Reihenfolge Planung → Recherche → Synthese eingehalten werden.
- `FR-14-04` Der Orchestrator MUSS von `web_lookup` auf `deep_research` hochstufen, wenn nach der ersten
  Iteration weniger als 2 verwertbare Quellen vorliegen; die Hochstufung erzeugt ein `plan.updated`-Event.
- `FR-14-05` Er MUSS Budgets prüfen und bei Überschreitung mit dem vorhandenen Material antworten.
- `FR-14-06` Er MUSS die Assistant-Message anlegen, Deltas streamen, Citations speichern und die Message finalisieren.
- `FR-14-07` Bei Fehlern MUSS er eine nutzerlesbare Antwort erzeugen, statt still zu scheitern.
- `FR-14-08` Follow-ups MÜSSEN vorhandene Quellen der Conversation wiederverwenden (Spec 33).

## Expected Behavior
Ablauf:
1. `run.started`, Status `routing`, `route()` (Spec 13).
2. Chat-Pfad: `synthesizing` → `streamText` → Message finalisieren → `run.completed`.
3. Research-Pfad: `planning` → `plan.created` → `researchEngine.run()` (Spec 24) → `synthesizing` →
   Antwort mit Citations → `run.completed`.
4. Abbruch jederzeit: Restarbeit wird verworfen, Teiltext bleibt.
5. Nach Abschluss: Titelgenerierung, falls die Conversation noch keinen Titel hat.

## User Flow
Nicht zutreffend (Backend).

## System Flow
Siehe Sequenzdiagramm in Spec 02. Der Orchestrator kennt nur Interfaces, keine Anbieter.

## Agent Behavior
Entscheidungen des Modells sind auf Pfadwahl, Plan, Suchanfragen, Quellenauswahl und Formulierung begrenzt.
Budget-, Sicherheits- und Statusentscheidungen trifft der Code.

## Contracts
`RunResult { messageId, sourceCount, citationCount, costMicroUsd, durationMs }`.

## API Requirements
Wird von `POST /api/runs` gestartet (ADR-006).

## Data Model
`runs`, `messages`, `run_events`, `sources`, `citations`.

## UI Requirements
Keine direkte; die UI folgt den Events.

## States
Alle `RunStatus`-Werte aus Spec 05.

## Telemetry & Events
Emittiert alle Run-Events; Log je Run: Task-Typ, Iterationen, Quellen, Dauer, Kosten.

## Configuration
Budgets aus Spec 43; `ESCALATION_MIN_SOURCES` (2).

## Edge Cases
1. Leere Nutzernachricht → wird bereits an der API abgelehnt.
2. Recherche findet nichts → ehrliche Antwort „keine belastbaren Quellen gefunden" plus Vorschläge; Status `completed`.
3. Alle Quellen schlagen beim Abruf fehl → Antwort auf Basis der Suchergebnis-Snippets mit deutlichem Hinweis.
4. Kostenlimit während der Recherche → `budget.warning`, dann Synthese mit vorhandenem Material.
5. Abbruch während der Planung → `cancelled`, keine Assistant-Message.
6. Synthese schlägt fehl → einmal wiederholen, dann `run.failed` mit `userMessage`.
7. Modell erzeugt Citation-Marker ohne Quelle → Marker wird entfernt (Spec 27).
8. Zweiter Run in derselben Conversation, während der erste läuft → beide laufen unabhängig.

## Error Handling
Jeder Abschnitt ist einzeln gekapselt; ein Teilfehler degradiert die Antwortqualität, beendet aber nicht den Run,
außer die Synthese selbst schlägt endgültig fehl.

## Security Considerations
Der Orchestrator übergibt Webinhalte ausschließlich als Datenblöcke (Spec 07) und führt niemals
Anweisungen aus Toolergebnissen aus.

## Performance Budget
Chat-Pfad: erstes Delta ≤ 2 s. Research-Pfad: erstes Event ≤ 1 s, Gesamtdauer ≤ 180 s.

## Test Plan
`tests/integration/orchestrator.test.ts` mit Fixture-Providern: Chat-Pfad, Research-Pfad,
Eskalation, Budgetstopp, Abbruch, Fehler in der Synthese, Follow-up mit vorhandenen Quellen.

## Acceptance Criteria
- `AC-14-01` Given „Hallo", Then keine `tool.call.*`-Events und `run.completed` in ≤ 3 s. (FR-14-02)
- `AC-14-02` Given eine Research-Anfrage, Then folgen `plan.created`, ≥ 1 `search.results`, ≥ 2 `source.opened`, `run.completed`. (FR-14-03)
- `AC-14-03` Given `web_lookup` mit < 2 verwertbaren Quellen, Then erscheint `plan.updated` mit Hochstufung. (FR-14-04)
- `AC-14-04` Given Kostenlimit erreicht, Then endet der Run `completed` mit Hinweis auf die Budgetgrenze. (FR-14-05)
- `AC-14-05` Given Abbruch nach `plan.created`, Then Status `cancelled` und keine weiteren Tool-Events. (FR-14-01)
- `AC-14-06` Given ein Follow-up ohne neuen Informationsbedarf, Then erfolgt keine neue Suche. (FR-14-08)

## Definition of Done
Alle Orchestrator-Tests grün; jeder Pfad endet garantiert in einem Endstatus.

## Dependencies
13, 15, 17, 18, 24, 33.

## Implementation Notes
`try/finally` garantiert das Endstatus-Event. Deltas werden alle 50 ms gebündelt persistiert,
um Schreiblast zu begrenzen.

## Open Decisions
Keine.
