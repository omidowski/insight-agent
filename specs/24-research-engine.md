---
id: 24-research-engine
title: Research Engine
phase: 4
milestone: MVP
status: done
depends_on: [19-tool-web-search, 20-tool-web-content-reader, 26-source-management]
provides: [research_run]
owner_modules: ["lib/agent/research/engine.ts"]
complexity: XL
---

# Research Engine

## Purpose
Beantwortet eine Teilfrage vollständig: Suchanfragen erzeugen, suchen, Quellen auswählen, öffnen,
Informationen extrahieren, vergleichen und ein belegtes Teilergebnis liefern.

## Scope / Out of Scope
In Scope: Ablauf einer Rechercheeinheit, Extraktion, Zwischenvergleich, Teilergebnis.
Out of Scope: Iterationssteuerung (Spec 25), Endsynthese (Spec 14/27), Konfliktdarstellung (Spec 28).

## User Story
„Als Nutzer möchte ich, dass der Agent Quellen tatsächlich liest, statt Suchsnippets zu paraphrasieren."

## Functional Requirements
- `FR-24-01` Je Teilfrage MÜSSEN 1–3 Suchanfragen erzeugt werden (Structured Output).
- `FR-24-02` Aus den Treffern MÜSSEN nach den Regeln aus Spec 26 bis zu `maxSourcesPerStep` (Default 5) Quellen geöffnet werden.
- `FR-24-03` Je geöffneter Quelle MUSS eine modellgestützte Extraktion erfolgen, die `{ claimKey, value, excerpt }`-Einträge liefert.
- `FR-24-04` Jedes Excerpt MUSS wörtlich im Quelltext vorkommen; sonst wird der Eintrag verworfen.
- `FR-24-05` Die Engine MUSS die Werte je `claimKey` über Quellen hinweg vergleichen und Übereinstimmung
  bzw. Abweichung feststellen (`sources.compared`).
- `FR-24-06` Das Teilergebnis MUSS Antwort, genutzte Quellen-IDs, Werte und `confidence` enthalten.
- `FR-24-07` Die Engine MUSS Abbruchsignal und Restbudget vor jedem Teilschritt prüfen.
- `FR-24-08` Ohne verwertbare Quelle MUSS ein leeres Ergebnis mit Begründung zurückgegeben werden — keine Erfindung.

## Expected Behavior
Ablauf je Teilfrage:
1. `queryGen` → Suchanfragen.
2. `web_search` je Anfrage → Treffer → Auswahl (Score, Vielfalt, `seen`).
3. `open_url` + `extract_content` je Auswahl (Parallelität 3, Domain-Ratelimit).
4. Extraktion je Quelle mit `extractionPrompt`; Eingabe ist ein Datenblock (Spec 07).
5. Excerpt-Verifikation gegen den Originaltext (exakt oder normalisiert whitespace-tolerant).
6. Aggregation je `claimKey`; Übereinstimmungen zählen, Abweichungen an Spec 28 melden.
7. `StepResult` zurückgeben.

`claimKey` ist ein normalisierter Bezeichner der Kennzahl, z. B. `musiala.tore.2025_26`,
`fc_bayern.umsatz.2024_25` — kleingeschrieben, Punkte als Trenner, keine Leerzeichen.

## User Flow
Sichtbar als Folge von Trace-Zeilen (Suche → Quelle geöffnet → extrahiert → verglichen).

## System Flow
`researchStep(step, ctx)` → `StepResult`; die Engine ruft Tools ausschließlich über den Executor (Spec 18).

## Agent Behavior
Das Modell entscheidet über Formulierung der Suchanfragen, Relevanz der Treffer und Auswahl der Excerpts.
Es darf keine Werte angeben, die nicht in einem Excerpt stehen.

## Contracts
```ts
interface ExtractionItem { claimKey: string; label: string; value: string; excerpt: string; confidence: number }
interface StepResult { stepId; answer; sourceIds; items: ExtractionItem[]; confidence; note? }
```

## API Requirements
Keine.

## Data Model
Schreibt `sources`, `excerpts`, `run_steps.result_json`.

## UI Requirements
Trace-Zeilen und Quellenpanel.

## States
Trägt zu `searching` → `reading_sources` → `extracting` → `comparing` bei.

## Telemetry & Events
`search.results`, `source.opened`, `source.extracted`, `sources.compared`.

## Configuration
`MAX_SOURCES_PER_STEP` (5), `MAX_QUERIES_PER_STEP` (3), `EXTRACTION_MAX_CHARS` (12000).

## Edge Cases
1. Alle Treffer bereits gesehen → keine neue Suche, vorhandene Excerpts werden wiederverwendet.
2. Quelle liefert keinen relevanten Inhalt → Ergebnis leer, Quelle bleibt gelistet mit Hinweis.
3. Extraktion liefert `value` ohne Excerpt → Eintrag verworfen.
4. Zwei Quellen mit identischem Wert → Übereinstimmung erhöht Trust (Spec 26).
5. Zwei Quellen mit abweichendem Wert → Konflikt (Spec 28), kein Mittelwert.
6. Sehr langer Quelltext → auf `EXTRACTION_MAX_CHARS` relevanzbasiert gekürzt (Spec 33).
7. Abbruch während der Extraktion → laufende Aufrufe brechen ab, Teilergebnis bleibt erhalten.
8. Zielseite enthält Anweisungen an den Agenten → als Daten behandelt, Vorfall wird geloggt (Spec 39).

## Error Handling
Fehler einzelner Quellen sind erwartbar; erst wenn keine Quelle verwertbar ist, gilt der Schritt als leer.

## Security Considerations
Extraktionsergebnisse werden gegen den Originaltext verifiziert — das ist zugleich Injektions- und
Halluzinationsschutz.

## Performance Budget
Teilfrage mit 5 Quellen ≤ 30 s im Realbetrieb; gegen den Test-Stub ≤ 2 s.

## Test Plan
`tests/integration/research-engine.test.ts`: vollständiger Schrittdurchlauf mit Fixtures;
Verwerfen erfundener Excerpts; Konflikterkennung; leeres Ergebnis ohne Quellen; Abbruch.

## Acceptance Criteria
- `AC-24-01` Given eine Teilfrage, Then werden 1–3 Suchanfragen erzeugt und ausgeführt. (FR-24-01)
- `AC-24-02` Given 5 geöffnete Quellen, Then existieren Excerpts mit gültigen Offsets. (FR-24-03, FR-24-04)
- `AC-24-03` Given ein vom Modell erfundenes Excerpt, Then erscheint es nicht im Ergebnis. (FR-24-04)
- `AC-24-04` Given zwei Quellen mit unterschiedlichem Wert zum selben `claimKey`, Then wird ein Konflikt gemeldet. (FR-24-05)
- `AC-24-05` Given keine verwertbare Quelle, Then ist `answer` leer mit `note` und ohne erfundene Fakten. (FR-24-08)

## Definition of Done
Engine-Tests grün; Trace zeigt die vollständige Sequenz.

## Dependencies
19, 20, 26, 28, 33.

## Implementation Notes
Excerpt-Verifikation: exakter Vergleich, sonst Vergleich nach Whitespace-Normalisierung, sonst Verwerfen.
Offsets werden auf dem normalisierten Text bestimmt und auf den Originaltext zurückgerechnet.

## Open Decisions
Keine.
