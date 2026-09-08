---
id: 20-tool-web-content-reader
title: Web Content Reader
phase: 4
milestone: MVP
status: done
depends_on: [18-tool-system-core, 39-prompt-injection-and-content-safety]
provides: [open_url, extract_content, search_in_page]
owner_modules: ["lib/tools/open-url.ts", "lib/util/html.ts", "lib/util/url-safety.ts"]
complexity: L
---

# Web Content Reader

## Purpose
Ruft Webseiten sicher ab und gewinnt daraus lesbaren Text, Metadaten und zitierfähige Ausschnitte.

## Scope / Out of Scope
In Scope: Abruf, SSRF-Guard, Größen- und Zeitlimits, HTML-Extraktion, Metadaten, `search_in_page`.
Out of Scope: Bewertung und Persistenz der Quelle (Spec 26), inhaltliche Extraktion durch das Modell (Spec 24).

## User Story
„Als Agent möchte ich den tatsächlichen Inhalt einer Seite lesen, statt nur den Suchsnippet zu verwenden."

## Functional Requirements
- `FR-20-01` Nur `http`/`https`; jede URL MUSS den SSRF-Guard passieren (Spec 39).
- `FR-20-02` Timeout `FETCH_TIMEOUT_MS` (8 s), maximal 3 Redirects, jede Zwischenstation wird erneut geprüft.
- `FR-20-03` Antwortgröße MUSS auf 2 MB begrenzt sein; Überschreitung → `CONTENT_TOO_LARGE`.
- `FR-20-04` Nur `text/html`, `text/plain`, `application/xhtml+xml` werden verarbeitet; andere Typen → `FETCH_BLOCKED` mit Hinweis.
- `FR-20-05` Die Extraktion MUSS Navigation, Skripte, Styles, Footer und Werbung entfernen und Fließtext,
  Überschriften, Listen und Tabellen erhalten.
- `FR-20-06` Metadaten (Titel, Autor, Veröffentlichungsdatum, kanonische URL) MÜSSEN aus `<title>`,
  `<meta>`, OpenGraph und JSON-LD gelesen werden.
- `FR-20-07` Der Text MUSS auf 40 000 Zeichen begrenzt und mit stabilen Offsets versehen werden.
- `FR-20-08` `search_in_page` MUSS Treffer mit Offsets und Kontextfenster (±200 Zeichen) liefern.
- `FR-20-09` Ein User-Agent MUSS gesetzt sein, der die Anwendung identifiziert; `robots.txt`-Disallow MUSS respektiert werden.

## Expected Behavior
Extraktionsheuristik: bevorzugt `<article>`, `[role=main]`, `<main>`; sonst der Container mit der
höchsten Textdichte. Blockelemente werden zu Absätzen; Tabellen zu Markdown; Überschriften bleiben erhalten.
Ergebnis: `{ url, canonicalUrl, domain, title, author?, publishedAt?, text, textLength, truncated, contentHash }`.

## User Flow
Sichtbar als „Quelle geöffnet: bundesliga.com" und „Statistiken extrahiert".

## System Flow
`open_url` → Guard → `fetch` mit Timeout und Größenlimit → Content-Type prüfen → `extractContent()` →
Ergebnis normalisieren → `source.opened`-Event.

## Agent Behavior
Der Agent öffnet nur Quellen, die er zuvor über die Suche gefunden hat oder die der Nutzer genannt hat —
niemals URLs, die in einem Seiteninhalt vorkommen (Injektionsschutz).

## Contracts
`FetchedPage` wie oben.

## API Requirements
Keine.

## Data Model
Füllt `sources` (Status `fetched`/`failed`) und liefert Text für `excerpts`.

## UI Requirements
Domain und Titel im Trace; Link öffnet extern.

## States
`discovered` → `fetched` | `failed` | `skipped`.

## Telemetry & Events
`source.opened`, `tool.call.*`; Metriken: Abrufdauer, Fehlerquote je Domain.

## Configuration
`FETCH_TIMEOUT_MS`, `FETCH_MAX_BYTES` (2 MB), `FETCH_USER_AGENT`, `RESPECT_ROBOTS` (true).

## Edge Cases
1. Weiterleitung auf eine interne IP → `FETCH_BLOCKED`.
2. Seite ohne Fließtext (reine App-Shell) → `text` leer → Quelle `skipped`, Snippet bleibt nutzbar.
3. Paywall-Hinweis erkannt → als `paywalled` markiert, kein Umgehungsversuch.
4. PDF-Link → im MVP `FETCH_BLOCKED` mit Hinweis „PDF wird noch nicht unterstützt" (Spec 32).
5. Sehr große Seite → auf 2 MB gelesen, Text auf 40 000 Zeichen gekürzt, `truncated: true`.
6. `robots.txt` verbietet den Pfad → Quelle `skipped` mit Begründung.
7. Ungültiges HTML → Extraktion liefert Best Effort statt Fehler.
8. Zeichensatz ≠ UTF-8 → über Content-Type oder `<meta charset>` dekodiert.

## Error Handling
Netzwerkfehler → `FETCH_FAILED` (retryable, 1 Wiederholung). Guard-Ablehnung → `FETCH_BLOCKED` (nicht retryable).

## Security Considerations
Kernstück des SSRF-Schutzes: DNS-Auflösung prüfen, private und Link-Local-Bereiche, `localhost`,
`.internal`, Metadata-IP `169.254.169.254` blockieren (Ausnahme nur über den Testschalter `ALLOW_LOOPBACK_FETCH`, Spec 47).
Keine Cookies, keine Authentifizierung, kein `Referer`.

## Performance Budget
Abruf + Extraktion ≤ 3 s je Seite (p95); Extraktion selbst ≤ 200 ms bei 500 KB HTML.

## Test Plan
`tests/unit/url-safety.test.ts` (Blockliste, Redirects, Demo-Ausnahme);
`tests/unit/html-extract.test.ts` (Artikel, Tabellen, JSON-LD-Datum, kaputtes HTML, Offsets).

## Acceptance Criteria
- `AC-20-01` Given `http://169.254.169.254/latest/meta-data`, Then `FETCH_BLOCKED`. (FR-20-01)
- `AC-20-02` Given eine Fixture-Artikelseite, Then enthält `text` den Fließtext und weder Navigation noch Skripte. (FR-20-05)
- `AC-20-03` Given JSON-LD mit `datePublished`, Then ist `publishedAt` gesetzt. (FR-20-06)
- `AC-20-04` Given eine 5-MB-Antwort, Then `CONTENT_TOO_LARGE` ohne vollständiges Laden. (FR-20-03)
- `AC-20-05` Given eine Weiterleitung auf `127.0.0.1` ohne `ALLOW_LOOPBACK_FETCH`, Then `FETCH_BLOCKED`. (Edge 1)
- `AC-20-06` Given `search_in_page("Umsatz")`, Then liefern die Treffer korrekte Offsets. (FR-20-08)

## Definition of Done
Alle Fetch- und Extraktionstests grün; Guard nachweislich aktiv.

## Dependencies
18, 39.

## Implementation Notes
Größenlimit über den Response-Stream (Abbruch beim Überschreiten), nicht erst nach `text()`.
`robots.txt` wird je Domain für 10 Minuten gecacht.

## Open Decisions
PDF-Unterstützung bewusst V2 (Spec 32).
