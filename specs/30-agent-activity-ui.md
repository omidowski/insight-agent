---
id: 30-agent-activity-ui
title: Agent Activity UI
phase: 5
milestone: MVP
status: done
depends_on: [09-streaming-protocol, 10-chat-interface]
provides: [activity_feed]
owner_modules: ["components/activity/*"]
complexity: M
---

# Agent Activity UI

## Purpose
Macht die Arbeit des Agenten verständlich sichtbar — ohne interne Modellgedanken, ausschließlich aus
den strukturierten Events.

## Scope / Out of Scope
In Scope: Activity-Karte, Statuszeile, Schrittliste, Tool-Aufrufe, Iterationen, Abschlusszusammenfassung.
Out of Scope: Quellendetails (Spec 31), Event-Transport (Spec 09).

## User Story
„Als Nutzer möchte ich live sehen, was der Agent tut, und ihm dadurch vertrauen können."

## Functional Requirements
- `FR-30-01` Die Karte MUSS erscheinen, sobald ein Run mit `showActivity` startet.
- `FR-30-02` Sie MUSS den aktuellen Status als deutschen Klartext anzeigen
  (`planning` → „Recherche wird geplant …").
- `FR-30-03` Sie MUSS eine chronologische Ereignisliste mit Zeitstempel führen.
- `FR-30-04` Sie MUSS Planschritte mit Status anzeigen.
- `FR-30-05` Sie DARF ausschließlich Event-Payloads darstellen — kein Modell-Reasoning.
- `FR-30-06` Nach Abschluss MUSS sie einklappbar sein und eine Zusammenfassung zeigen
  (Dauer, Quellen, Suchen, Iterationen, Kosten optional).
- `FR-30-07` Sie MUSS bei Reload aus persistierten Events vollständig rekonstruierbar sein.

## Expected Behavior
Statusabbildung: `routing` „Anfrage wird analysiert …" · `planning` „Recherche wird geplant …" ·
`searching` „Suche läuft …" · `reading_sources` „Quellen werden gelesen …" · `extracting`
„Informationen werden extrahiert …" · `comparing` „Quellen werden verglichen …" · `synthesizing`
„Antwort wird erstellt …" · `completed` „Recherche abgeschlossen" · `failed` „Fehlgeschlagen" ·
`cancelled` „Abgebrochen".

Ereigniszeilen (Beispiele): „Suche: ‚Jamal Musiala statistics 2025/26'" · „8 Quellen gefunden" ·
„Quelle geöffnet: bundesliga.com" · „12 Werte extrahiert" · „1 Abweichung gefunden" ·
„Weitere Recherche gestartet (2 offene Punkte)".

## User Flow
Karte erscheint über der entstehenden Antwort, läuft mit, klappt nach Abschluss zusammen und bleibt aufklappbar.

## System Flow
Reducer bildet die Eventfolge auf `ActivityState` ab; identische Folgeereignisse werden zusammengefasst
(„3 Quellen geöffnet"), sobald mehr als 5 gleichartige Zeilen entstehen.

## Agent Behavior
Nicht zutreffend.

## Contracts
`ActivityState { status, steps, lines, counters: { searches, sources, iterations, conflicts }, summary? }`.

## API Requirements
Keine.

## Data Model
Keine eigene.

## UI Requirements
Kompakte Karte mit Statuszeile und Fortschrittsindikator; maximal 200 sichtbare Zeilen (ältere ausklappbar);
`aria-live="polite"` für die Statuszeile; Reduktion von Animationen bei `prefers-reduced-motion`.

## States
`hidden` · `active` · `collapsed` · `error`.

## Telemetry & Events
Konsument von Spec 09.

## Configuration
Keine.

## Edge Cases
1. Sehr viele Events (> 500) → Gruppierung und Begrenzung, kein Einfrieren der UI.
2. Unbekannter Event-Typ → wird ignoriert, Trace läuft weiter.
3. Run bricht ab → letzte Zeile „Abgebrochen", bisherige bleiben.
4. Run ohne Research (Chat) → keine Karte.
5. Reload während des Runs → Karte wird aus Events rekonstruiert.
6. Zwei parallele Runs → jede Antwort hat ihre eigene Karte.

## Error Handling
`run.failed` zeigt `userMessage` in der Karte und färbt die Statuszeile.

## Security Considerations
Alle Texte werden escaped; Quelltitel und Suchanfragen stammen aus untrusted Inhalten.

## Performance Budget
Rendern von 200 Zeilen ≤ 16 ms je Frame; Events werden pro Frame gebündelt.

## Test Plan
`tests/unit/activity-reducer.test.ts`: Eventfolge → erwarteter State, Gruppierung, unbekannte Typen,
Rekonstruktion aus persistierten Events.

## Acceptance Criteria
- `AC-30-01` Given die Eventfolge eines Research-Runs, Then zeigt die Karte Plan, Suchen, Quellen und Abschluss. (FR-30-03, FR-30-04)
- `AC-30-02` Given `status.changed` nach `searching`, Then lautet die Statuszeile „Suche läuft …". (FR-30-02)
- `AC-30-03` Given 20 `source.opened`-Events, Then entstehen gruppierte Zeilen statt 20 Einzelzeilen. (Edge 1)
- `AC-30-04` Given einen Chat-Run, Then erscheint keine Karte. (FR-30-01)
- `AC-30-05` Given Reload, Then ist der Trace identisch zum Verlauf vor dem Reload. (FR-30-07)

## Definition of Done
Reducer-Tests grün; Karte in Hell und Dunkel geprüft.

## Dependencies
09, 10.

## Implementation Notes
Reducer ist eine reine Funktion `(state, event) => state` und wird sowohl live als auch beim Replay verwendet.

## Open Decisions
Kostenanzeige nur, wenn `SHOW_COSTS=true`.
