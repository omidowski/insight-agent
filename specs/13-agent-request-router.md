---
id: 13-agent-request-router
title: Agent Request Router
phase: 3
milestone: MVP
status: done
depends_on: [06-openai-integration, 07-prompt-management]
provides: [task_classification]
owner_modules: ["lib/agent/router.ts"]
complexity: M
---

# Agent Request Router

## Purpose
Bestimmt, welcher Ausführungspfad für eine Nutzernachricht gilt. Verhindert, dass „Hallo" eine Recherche
auslöst und dass eine Rechercheaufgabe als Plauderei beantwortet wird.

## Scope / Out of Scope
In Scope: Klassifikation, Confidence-Regeln, Pfadkonfiguration je Task-Typ.
Out of Scope: Ausführung (Spec 14), Planung (Spec 15).

## User Story
„Als Nutzer möchte ich einfache Fragen sofort beantwortet bekommen und für Rechercheaufgaben eine echte Recherche."

## Functional Requirements
- `FR-13-01` Die Klassifikation MUSS per Structured Output `{ taskType, confidence, summary, clarificationNeeded }` erfolgen.
- `FR-13-02` Bei `confidence < 0.6` MUSS der günstigere Pfad gewählt werden; bei `clarificationNeeded`
  und `confidence < 0.4` MUSS genau eine Rückfrage gestellt werden.
- `FR-13-03` Ein expliziter `mode` aus der API MUSS die Klassifikation überschreiben.
- `FR-13-04` Je Task-Typ MÜSSEN Tool-Allowlist, Modellwahl, Budgets und UI-Sichtbarkeit definiert sein.
- `FR-13-05` Der Router MUSS den Verlauf der letzten 6 Nachrichten berücksichtigen (Follow-ups).
- `FR-13-06` Bei `unsafe_or_refused` MUSS ohne Tool-Aufruf eine sachliche Ablehnung folgen.

## Expected Behavior
| TaskType | Tools | Modell | Budgets | Activity-UI |
|---|---|---|---|---|
| `conversation` | – | main | 1 Aufruf | nein |
| `knowledge_question` | – | main | 1 Aufruf | nein |
| `web_lookup` | web_search, open_url, extract_content | fast+main | 1 Iteration, 3 Suchen, 5 Quellen | ja |
| `deep_research` | alle Recherche-Tools | fast+main | 3 Iterationen, 12 Suchen, 15 Quellen | ja |
| `comparison` | alle Recherche-Tools | fast+main | wie deep_research | ja |
| `multi_step_task` | alle Recherche-Tools + utilities | fast+main | wie deep_research | ja |
| `report_generation` (V1) | wie deep_research | main | erhöht | ja |
| `document_analysis` (V2) | file_search, document_reader | fast+main | – | ja |
| `data_analysis` (V2) | calculator, code_execution | fast+main | – | ja |
| `unsafe_or_refused` | – | fast | 1 Aufruf | nein |

Heuristische Vorprüfung vor dem Modellaufruf: Nachrichten ≤ 3 Wörter aus einer Grußliste werden ohne
Modellaufruf als `conversation` klassifiziert (Latenz und Kosten).

## User Flow
Für den Nutzer unsichtbar, außer bei Rückfragen.

## System Flow
`route(input, history, mode)` → `RouteDecision { taskType, confidence, summary, budgets, allowedTools, showActivity }`.
Emittiert `router.classified`.

## Agent Behavior
Der Router entscheidet ausschließlich über den Pfad, nie über den Inhalt der Antwort.

## Contracts
`RouteDecision` in `lib/contracts/domain.ts`.

## API Requirements
Keine eigene; `mode` kommt aus `POST /api/runs`.

## Data Model
`runs.task_type`, `runs.confidence`, `runs.budgets_json`.

## UI Requirements
`showActivity` steuert, ob die Activity-Karte erscheint.

## States
Beitrag zum Run-Status: `routing` → nachfolgender Status.

## Telemetry & Events
`router.classified` mit `taskType`, `confidence`, `summary` (≤ 120 Zeichen).

## Configuration
`ROUTER_CONFIDENCE_THRESHOLD` (0.6), `ROUTER_CLARIFY_THRESHOLD` (0.4).

## Edge Cases
1. „Hallo, kannst du zu X recherchieren?" → `deep_research` (Aufgabe schlägt Gruß).
2. Reine Meinungsfrage ohne Faktenbedarf → `knowledge_question`.
3. Folgefrage „und 2024?" → Kontext aus der History, gleicher Pfad wie zuvor.
4. Unklare Einzelwortanfrage „Musiala" → `web_lookup`, nicht `deep_research`.
5. Modellantwort mit unbekanntem Typ → `knowledge_question`, `confidence = 0`.
6. Anfrage nach schädlichen Inhalten → `unsafe_or_refused`.
7. Router-Aufruf schlägt fehl → Fallback `knowledge_question` mit Log, Run läuft weiter.

## Error Handling
`LLM_*`-Fehler führen nicht zum Abbruch, sondern zum Fallback-Pfad.

## Security Considerations
Der Router sieht nur Nutzertext, nie Webinhalte — er ist damit kein Injektionsziel.

## Performance Budget
≤ 1,5 s im Realbetrieb; ≤ 5 ms bei heuristischer Vorprüfung.

## Test Plan
`tests/unit/router.test.ts` mit ≥ 20 Beispieleingaben (positiv und negativ je Typ) gegen den Fixture-Provider.

## Acceptance Criteria
- `AC-13-01` Given „Hallo", Then `taskType = conversation` ohne Modellaufruf. (FR-13-01)
- `AC-13-02` Given „Recherchiere aktuelle Statistiken zu X", Then `taskType = deep_research`. (FR-13-01)
- `AC-13-03` Given `mode = chat` bei einer Research-Frage, Then wird kein Research-Pfad gewählt. (FR-13-03)
- `AC-13-04` Given `confidence = 0.3` und `clarificationNeeded`, Then stellt der Agent eine Rückfrage ohne Tool-Aufruf. (FR-13-02)
- `AC-13-05` Given Router-Fehler, Then läuft der Run als `knowledge_question` weiter. (Edge 7)

## Definition of Done
Router-Tests grün; Pfadkonfiguration zentral in `lib/agent/paths.ts`.

## Dependencies
06, 07.

## Implementation Notes
Pfadkonfiguration als Tabelle, nicht als `switch` verstreut im Orchestrator.

## Open Decisions
Keine.
