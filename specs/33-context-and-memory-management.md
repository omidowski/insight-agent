---
id: 33-context-and-memory-management
title: Context & Memory Management
phase: 5
milestone: MVP
status: done
depends_on: [05-shared-contracts, 26-source-management]
provides: [context_budget, followup_context]
owner_modules: ["lib/agent/context.ts", "lib/util/tokens.ts"]
complexity: M
---

# Context & Memory Management

## Purpose
Hält jede Modelleingabe innerhalb des Token-Budgets und stellt sicher, dass Follow-ups den vorhandenen
Recherchekontext nutzen, statt alles neu zu recherchieren.

## Scope / Out of Scope
In Scope: Token-Schätzung, Kürzungsstrategien, Auswahl des Verlaufs, Wiederverwendung von Quellen.
Out of Scope: Langzeit-Nutzerprofile (V2), Vector-Retrieval (Spec 22).

## User Story
„Als Nutzer möchte ich Rückfragen stellen können, ohne dass die Recherche von vorn beginnt."

## Functional Requirements
- `FR-33-01` Jede Modelleingabe MUSS vor dem Senden gegen `maxInputTokens` geprüft und bei Bedarf gekürzt werden.
- `FR-33-02` Kürzungsreihenfolge: älteste Verlaufsnachrichten → weniger relevante Quellenabschnitte →
  weniger relevante Excerpts. Nutzerfrage, Plan und Konflikte werden nie gekürzt.
- `FR-33-03` Quelltexte MÜSSEN relevanzbasiert gekürzt werden (Absätze mit der höchsten Begriffsüberdeckung zur Teilfrage).
- `FR-33-04` Bei einem Follow-up MUSS entschieden werden, ob vorhandene Quellen ausreichen; nur bei
  Informationsbedarf wird neu recherchiert.
- `FR-33-05` Der Verlauf MUSS auf die letzten 12 Nachrichten begrenzt werden; ältere werden zu einer
  Kurzfassung zusammengefasst (max. 500 Zeichen).
- `FR-33-06` Die Token-Schätzung MUSS ohne Netzwerkzugriff funktionieren.

## Expected Behavior
Follow-up-Entscheidung (Structured Output `{ needsNewResearch: boolean, reason }`): Fragen nach
Erläuterung, Zusammenfassung, Umformatierung oder Details aus bereits geladenen Quellen → keine neue Recherche.
Fragen nach neuen Zeiträumen, Entitäten oder Kennzahlen → neue Recherche.

Token-Schätzung: `ceil(zeichen / 3.7)` für deutschsprachige Texte, mit 10 % Sicherheitsaufschlag.

## User Flow
Für den Nutzer unsichtbar, außer als spürbar schnellere Follow-up-Antwort.

## System Flow
`buildContext(purpose, parts, budget)` → gekürzte, priorisierte Eingabe + Kürzungsprotokoll im Log.

## Agent Behavior
Der Agent MUSS in der Antwort kenntlich machen, wenn er ausschließlich auf bereits vorhandene Quellen zurückgreift.

## Contracts
`ContextPart { role, label, content, priority: number, truncatable: boolean }`.

## API Requirements / Data Model / UI Requirements
Keine eigenen.

## States
Nicht zutreffend.

## Telemetry & Events
Log bei Kürzung: Zweck, geschätzte Token vorher/nachher, entfernte Teile.

## Configuration
`MAX_INPUT_TOKENS` (150000), `HISTORY_MESSAGE_LIMIT` (12).

## Edge Cases
1. Einzelne Quelle größer als das gesamte Budget → auf die relevantesten Absätze reduziert.
2. Sehr langer Verlauf → Zusammenfassung plus letzte 12 Nachrichten.
3. Follow-up ohne vorherige Recherche → normale Klassifikation.
4. „Fasse das nochmal kürzer" → keine neue Recherche.
5. „Und wie war es 2023?" → neue Recherche.
6. Budget bereits durch die Nutzerfrage überschritten → Frage wird nicht gekürzt, stattdessen Fehler
   `CONTENT_TOO_LARGE` mit Hinweis.

## Error Handling
Kürzung darf nie Pflichtteile (Frage, Plan, Konflikte) entfernen; sonst `CONTENT_TOO_LARGE`.

## Security Considerations
Beim Kürzen bleiben die Datenblock-Marker intakt, damit die Trennung Instruktion/Daten erhalten bleibt.

## Performance Budget
Kontextaufbau ≤ 20 ms bei 20 Quellen.

## Test Plan
`tests/unit/context.test.ts`: Kürzungsreihenfolge, Schutz der Pflichtteile, Relevanzkürzung,
Follow-up-Entscheidung in beiden Richtungen.

## Acceptance Criteria
- `AC-33-01` Given eine Eingabe über Budget, Then wird zuerst der älteste Verlauf entfernt. (FR-33-02)
- `AC-33-02` Given „fasse kürzer", Then `needsNewResearch = false` und keine Suche. (FR-33-04)
- `AC-33-03` Given „und 2023?", Then `needsNewResearch = true`. (FR-33-04)
- `AC-33-04` Given eine übergroße Quelle, Then bleiben die relevantesten Absätze erhalten. (FR-33-03)

## Definition of Done
Kontext-Tests grün; Follow-up-Test im Orchestrator grün.

## Dependencies
05, 26.

## Implementation Notes
Relevanz über Token-Overlap mit der Teilfrage; Absätze werden nie mitten im Satz abgeschnitten.

## Open Decisions
Echtes Retrieval über Embeddings erst mit Spec 22.
