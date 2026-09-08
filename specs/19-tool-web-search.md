---
id: 19-tool-web-search
title: Web Search Tool
phase: 4
milestone: MVP
status: done
depends_on: [18-tool-system-core, 47-provider-setup]
provides: [web_search]
owner_modules: ["lib/tools/web-search.ts", "lib/search/*"]
complexity: L
---

# Web Search Tool

## Purpose
Findet Kandidatenquellen zu einer Suchanfrage — anbieterunabhängig, normalisiert und dedupliziert.

## Scope / Out of Scope
In Scope: SearchProvider-Interface, Anbieter, Query-Normalisierung, Ergebnisnormalisierung, Dedup, Ranking-Vorstufe.
Out of Scope: Abruf der Seiten (Spec 20), Bewertung der Quellen (Spec 26).

## User Story
„Als Agent möchte ich zu einer Teilfrage relevante Webseiten finden."

## Functional Requirements
- `FR-19-01` `SearchProvider.search(query, opts)` MUSS normalisierte Treffer
  `{ title, url, snippet, publishedAt?, rank }` liefern.
- `FR-19-02` Anbieter MÜSSEN austauschbar sein: `openai`, `brave`, `tavily`; Auswahl per Konfiguration.
  Ist keiner verfügbar, MUSS `SEARCH_NOT_CONFIGURED` gemeldet werden — es gibt keinen Ersatzanbieter.
- `FR-19-03` Ergebnisse MÜSSEN über `canonical_url` dedupliziert und auf `maxResults` (Default 8) begrenzt werden.
- `FR-19-04` Bereits im Run gesehene URLs MÜSSEN markiert (`seen: true`) und nicht erneut geöffnet werden.
- `FR-19-05` Suchanfragen MÜSSEN protokolliert und als `search.results`-Event sichtbar gemacht werden.
- `FR-19-06` Suchanfragen DÜRFEN keine Inhalte enthalten, die nicht aus Nutzeranfrage oder Plan stammen (Exfiltrationsschutz).
- `FR-19-07` Anbieterfehler MÜSSEN zu `SEARCH_FAILED` führen, ohne den Run zu beenden.

## Expected Behavior
Query-Normalisierung: Trim, Mehrfachleerzeichen entfernt, max. 200 Zeichen, keine Zeilenumbrüche,
Anführungszeichen erhalten. Identische Query im selben Run → Cache.
`canonical_url`: Schema und Host klein, `www.` entfernt, Fragment entfernt, Tracking-Parameter
(`utm_*`, `gclid`, `fbclid`, `ref`) entfernt, Trailing-Slash normalisiert.

## User Flow
Sichtbar als „Suche: … · 8 Quellen gefunden".

## System Flow
Tool `web_search` → Provider → Normalisierung → Dedup → Ergebnis + Event.

## Agent Behavior
Das Modell erzeugt 1–3 Suchanfragen je Teilfrage, bevorzugt präzise Formulierungen mit Jahreszahl,
wenn Aktualität gefragt ist.

## Contracts
```ts
interface SearchProvider { name: string;
  search(query: string, opts: { maxResults: number; signal?: AbortSignal }): Promise<SearchHit[]>; }
```

## API Requirements
Keine.

## Data Model
Treffer werden als `sources` mit Status `discovered` angelegt (Spec 26).

## UI Requirements
Suchanfrage und Trefferzahl im Trace (Spec 30).

## States
Tool-Call-Status (Spec 18).

## Telemetry & Events
`search.results { query, count, topDomains }`; Metrik: Treffer je Suche, Anbieterfehlerquote.

## Configuration
`SEARCH_PROVIDER`, `SEARCH_MAX_RESULTS` (8), Anbieter-Keys.

## Edge Cases
1. Null Treffer → Event mit `count: 0`; der Agent formuliert die Anfrage um (max. 2 Versuche).
2. Anbieter-Ratelimit → einmal Backoff, dann `SEARCH_FAILED`.
3. Treffer ohne Titel → Domain als Ersatztitel.
4. Nur PDF-Treffer → zulässig; die Extraktion erkennt den Typ (im MVP: Hinweis, kein Parsing).
5. Sehr lange Query → auf 200 Zeichen gekürzt.
6. Doppelte Treffer verschiedener Anbieterseiten (mit/ohne `www`) → eine Quelle.

## Error Handling
`SEARCH_FAILED` wird als Tool-Ergebnis zurückgegeben, damit das Modell die Anfrage anpassen kann.

## Security Considerations
FR-19-06 verhindert das Abfließen von Konversationsinhalten in Suchanfragen.
Keine Nutzerkennungen in Suchanfragen.

## Performance Budget
≤ 4 s je Suche; Cache-Treffer ≤ 1 ms.

## Test Plan
`tests/unit/web-search.test.ts`: Normalisierung, Dedup, Cache, Fehlerpfad, `seen`-Markierung.

## Acceptance Criteria
- `AC-19-01` Given zwei Treffer mit `www.` und ohne, Then bleibt eine Quelle. (FR-19-03)
- `AC-19-02` Given dieselbe Query zweimal im Run, Then wird der Anbieter nur einmal aufgerufen. (Cache)
- `AC-19-03` Given Anbieterfehler, Then erhält das Modell `SEARCH_FAILED` und der Run läuft weiter. (FR-19-07)
- `AC-19-04` Given eine Suche, Then existiert genau ein `search.results`-Event mit korrekter Trefferzahl. (FR-19-05)

## Definition of Done
Tests grün; mindestens zwei Realanbieter implementiert (OpenAI-Suche, Tavily/Brave).

## Dependencies
18, 26, 47.

## Implementation Notes
`openai`-Anbieter nutzt die Responses API mit aktiviertem Web-Search-Tool und liefert per Structured
Output eine Trefferliste; Ergebnisse werden identisch normalisiert.

## Open Decisions
Siehe OPEN-QUESTIONS Nr. 2.
