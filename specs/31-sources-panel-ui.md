---
id: 31-sources-panel-ui
title: Sources Panel UI
phase: 5
milestone: MVP
status: done
depends_on: [26-source-management, 27-citation-system]
provides: [sources_panel]
owner_modules: ["components/sources/*"]
complexity: M
---

# Sources Panel UI

## Purpose
Macht Quellen und Belege prüfbar: Liste, Details, Excerpts, Konflikthinweise und Sprung von Marker zu Quelle.

## Scope / Out of Scope
In Scope: Panel, Quellenkarten, Excerpt-Anzeige, Verknüpfung mit Markern, Filter.
Out of Scope: Bewertungslogik (Spec 26).

## User Story
„Als Nutzer möchte ich nachlesen, welche Textstelle eine Aussage belegt."

## Functional Requirements
- `FR-31-01` Das Panel MUSS alle Quellen des aktuellen Runs mit Nummer, Titel, Domain, Datum und Trust-Anzeige listen.
- `FR-31-02` Ein Klick auf einen Citation-Marker MUSS die Quelle hervorheben und in den Sichtbereich scrollen.
- `FR-31-03` Jede Quellenkarte MUSS die zugehörigen Excerpts anzeigen (ausklappbar).
- `FR-31-04` Quellen mit Konflikt MÜSSEN gekennzeichnet sein.
- `FR-31-05` Fehlgeschlagene oder übersprungene Quellen MÜSSEN mit Grund sichtbar sein (getrennter Bereich).
- `FR-31-06` Links MÜSSEN extern öffnen mit `rel="noopener noreferrer"`.
- `FR-31-07` Auf Mobil MUSS das Panel als Overlay über eine Schaltfläche erreichbar sein.

## Expected Behavior
Sortierung nach `index_num`. Trust wird als dreistufige Anzeige dargestellt
(hoch ≥ 0,7 · mittel ≥ 0,45 · niedrig darunter) mit Tooltip zur Begründung.
Kopfzeile: „N Quellen · M Excerpts · K Abweichungen".

## User Flow
Antwort lesen → `[2]` klicken → Panel scrollt zu Quelle 2, hebt sie 2 s hervor → Excerpt aufklappen → Link öffnen.

## System Flow
Daten aus dem Run-State bzw. `GET /api/runs/:id`; Live-Aktualisierung über `source.opened`/`source.extracted`.

## Agent Behavior
Nicht zutreffend.

## Contracts
`SourceView { index, title, url, domain, publishedAt?, trustScore, status, excerpts, hasConflict }`.

## API Requirements
Keine eigene.

## Data Model
Keine eigene.

## UI Requirements
Rechte Spalte ab 1024 px, sonst Overlay; Tastaturnavigation zwischen Quellen; Fokus folgt dem Marker-Klick.

## States
`empty` · `loading` · `ready`.

## Telemetry & Events
Keine.

## Configuration
Keine.

## Edge Cases
1. Keine Quellen (Chat-Run) → Panel bleibt verborgen.
2. Quelle ohne Datum → „Datum unbekannt".
3. Sehr langer Titel → auf zwei Zeilen gekürzt mit Tooltip.
4. 30 Quellen → virtuelles Rendern nicht nötig, aber Scrollbereich mit Kopfzähler.
5. Excerpt mit 1 500 Zeichen → gekürzt mit „mehr anzeigen".
6. Quelle `failed` → im Bereich „Nicht verwendbar" mit Fehlergrund.

## Error Handling
Fehlende Excerpts → Hinweis „kein Textbeleg gespeichert", kein Fehler.

## Security Considerations
Titel, Snippets und Excerpts sind untrusted → escaped rendern; URLs vor der Anzeige validieren.

## Performance Budget
Rendern von 30 Quellen ≤ 30 ms.

## Test Plan
`tests/unit/sources-panel.test.ts`: Sortierung, Trust-Stufen, Marker-Sprung, Fehlerbereich, Konfliktmarkierung.

## Acceptance Criteria
- `AC-31-01` Given 5 Quellen, Then erscheinen sie mit den Nummern 1–5 in Öffnungsreihenfolge. (FR-31-01)
- `AC-31-02` Given Klick auf `[3]`, Then wird Quelle 3 hervorgehoben und sichtbar. (FR-31-02)
- `AC-31-03` Given eine Quelle mit Konflikt, Then trägt sie eine Kennzeichnung. (FR-31-04)
- `AC-31-04` Given eine fehlgeschlagene Quelle, Then erscheint sie mit Grund im getrennten Bereich. (FR-31-05)

## Definition of Done
Panel-Tests grün; Marker-Sprung funktioniert auch auf Mobil.

## Dependencies
26, 27.

## Implementation Notes
Hervorhebung über einen `highlightedSourceId`-State im Chat-Context, nicht über direkte DOM-Manipulation.

## Open Decisions
Keine.
