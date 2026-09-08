# Implementation Log

## 2026-09-01 — Phase 1–6 (MVP) implementiert

Vorgehen nach `PROMPT-2-implementation-loop.md`, Reihenfolge nach `specs/INDEX.md`.

### Phase 1 — Foundation
`01, 03, 43, 05, 04, 47, 06, 07, 02` · Projektstruktur, Konventionen, Contracts, SQLite-Persistenz,
Config, LLM-Provider (OpenAI + Fixture), Prompts.
- **ADR-009**: Migrationen als TS-Modul statt `.sql`-Dateien — Next.js bündelt Servercode, ein
  Laufzeit-`fs`-Zugriff wäre nicht garantiert. Spec 04 entsprechend aktualisiert.
- `node:sqlite` wird über `process.getBuiltinModule` geladen, weil weder webpack noch Vite es als
  Builtin kennen und die statische Referenz den Build brach.

### Phase 2 — Basic Chat
`09, 08, 11, 12, 10` · SSE-Protokoll mit Replay und Resume, alle Endpunkte, Conversations, sanitisiertes
Markdown mit klickbaren Citation-Markern, Chat-UI mit Stop/Retry/Modusumschalter.
- **ADR-010**: Fixture-Route von `/api/__fixtures/...` nach `/api/demo/pages/...` verschoben —
  `_`-Präfixe sind im App Router private Ordner und erzeugen keine Route.

### Phase 3 — Agent Core
`18, 17, 13, 14, 15, 16, 21` · Tool-Registry mit Guards/Timeout/Retry/Cache, Run-State mit
Übergangsmatrix und Budgets, Router mit Confidence-Regeln, Orchestrator, Planer mit Zyklusauflösung,
parallele Schrittausführung, Calculator/Datetime.

### Phase 4 — Research
`19, 20, 26, 24, 25, 27, 28` · Suchanbieter-Abstraktion, sicherer Seitenabruf mit SSRF-Guard und
HTML-Extraktion, Quellenverwaltung mit Trust-Score und Dedup, Recherche-Engine mit
Excerpt-Verifikation, iterativer Loop mit Sättigungserkennung, Citations, Widerspruchserkennung.

### Phase 5 — Agent UX
`30, 31, 33` · Activity-Feed aus dem reinen Event-Reducer, Quellenpanel mit Belegen und
Konfliktkennzeichnung, Kontext-/Follow-up-Management.

### Phase 6 — Härtung
`38, 39, 36, 37, 40, 42` · Fehlerregime, Injektions- und SSRF-Schutz, Rate Limits, Kostenkontrolle,
Logger mit Redaction, Testaufbau.

### Im Test gefundene und behobene Fehler
| Fund | Ursache | Fix |
|---|---|---|
| Abbruch wirkungslos (Smoke-Test) | Next.js führt Route-Handler in getrennten Modulinstanzen aus, die In-Process-Registry war im Cancel-Handler leer | **ADR-011**: persistentes `runs.cancel_requested` + 250-ms-Watcher; Abbruch wirkt jetzt in ~1 s |
| Nachrichtenreihenfolge instabil | Zwei Inserts in derselben Millisekunde, ULID-Zufallsanteil entschied die Sortierung | Sortierung nach `created_at, rowid` |
| Kanonisierung ließ Trailing-Slash bei Query stehen | Reihenfolge der Normalisierungsschritte | Pfad vor der Serialisierung normalisieren |
| SSE lieferte Secrets aus direkt geschriebenen Events | Redaction saß nur im Emitter | Zusätzliche Redaction unmittelbar vor dem Senden |
| Prompt-Literal außerhalb von `lib/agent/prompts` | Suchanbieter hatte eine eigene Instruktion | Nach `prompts/index.ts` verschoben (Konventionstest deckt das ab) |
| Technische `claimKeys` in der Antwort | Synthese-Kontext enthielt Schlüssel als Präfix | Nur Excerpt-Text an die Synthese |
| Falsch-positive „nicht belegt"-Meldungen | Meta-Sätze wurden als Sachaussagen gewertet | Heuristik verschärft (Wortzahl, Meta-Begriffe, Listen/Überschriften) |
| Doppelte „Offene Punkte" | Wiederholte Teilfragen in Folgeiterationen | Lücken werden dedupliziert |

### Nachtrag 2026-09-01 — Demo-Modus liefert fachfremde Quellen
**Gemeldet:** „Für alle Fragen antwortet er dasselbe."
**Befund:** Korrekt und zweifach begründet.
1. Ohne `OPENAI_API_KEY` läuft der Fixture-Provider — es antwortet kein Sprachmodell, sondern eine
   Vorlage. Für Konversationsfragen war das immer derselbe Text.
2. **Fehler:** Der Fixture-Suchanbieter lieferte bei fehlender Übereinstimmung Ersatztreffer
   (`matches.slice(0, 3)`), und generische Wörter wie „Statistiken" galten als Thementreffer.
   Eine Frage zur Wirtschaftslage in Portugal wurde dadurch mit Musiala-Quellen „belegt" —
   ein Verstoß gegen Spec 24, FR-24-08.

**Fix:** Keine Ersatztreffer mehr; generische Begriffe zählen nicht als Themenübereinstimmung;
Wortanfangs- statt Teilstringvergleich (`und` traf zuvor `bundesliga`); Demo-Badge sagt jetzt
ausdrücklich „kein Sprachmodell aktiv". Neuer Test `AC-47-05` sichert das ab.

### Nachtrag 2026-09-01 (2) — „Wie ist das Wetter in Hamburg?" wird nicht beantwortet
**Befund:** Zwei Punkte.
1. **Routing-Lücke im Fixture-Router:** Fragen nach dem Jetzt-Zustand (Wetter, Kurse, Preise, Verkehr)
   landeten als `knowledge_question` ohne Quellenbedarf. Sie sind aber per Definition nur mit Quelle
   beantwortbar. Neu: Muster `LIVE_FACT` stuft sie als `web_lookup` ein; der Orchestrator stuft
   anschließend regelkonform auf `deep_research` hoch, wenn zu wenige Quellen gefunden werden (FR-14-04).
2. **Keine Fehlfunktion, sondern Demo-Grenze:** Ohne API-Key gibt es weder Modell noch Websuche.
   Die Antwort war jedoch nichtssagend. Neu: Sie nennt den Grund, die drei abgedeckten Beispielthemen
   und den Weg zum Realbetrieb (`OPENAI_API_KEY` in `.env.local`).

Neue Anforderungen `FR-47-08`, `FR-47-09` und Kriterium `AC-47-06` in Spec 47 ergänzt.

### 2026-09-08 — Simulierte Antworten entfernt, Modellauswahl ergänzt
**Auftrag:** „mach alles mock weg und gib mir viele Modelle zur Auswahl."

**Entfernt (ADR-013):** `lib/llm/fixture.ts`, `lib/search/fixture.ts`, `lib/fixtures/pages.ts`,
`/api/demo/pages/[slug]`, das Feld `demoMode` und der `fixture`-Suchanbieter. Ohne konfigurierten
Anbieter antwortet die App nicht mehr, sondern zeigt einen Einrichtungshinweis und sperrt das Senden
(`LLM_NOT_CONFIGURED`, `SEARCH_NOT_CONFIGURED`). Der SSRF-Guard erlaubt Loopback nur noch über den
ausdrücklichen Testschalter `ALLOW_LOOPBACK_FETCH` — vorher hing die Ausnahme am Demo-Modus.

**Test-Strategie umgestellt (ADR-014):** Die Doubles liegen unter `tests/doubles/`; ein lokaler
Stub-Server beantwortet `/v1/chat/completions` (auch streamend), `/v1/models`, die Tavily-Suche und
liefert Testseiten aus. Die Suite richtet `LLM_BASE_URL` und `TAVILY_BASE_URL` darauf aus, sodass im
Test derselbe Provider-Code läuft wie in Produktion — inklusive HTTP, Streaming, Fehlerabbildung und
SSRF-Guard. Dafür wurden `BRAVE_BASE_URL` und `TAVILY_BASE_URL` konfigurierbar (nützlich auch für Proxys).
Der Smoke-Test wurde von einem `.mjs`-Skript auf eine Vitest-Datei mit eigener Konfiguration umgestellt.

**Modellauswahl (Spec 48):** `GET /api/models` ruft den Katalog des aktiven Anbieters live ab,
stellt kuratierte Empfehlungen voran, filtert ungeeignete Modelle (Embeddings, Audio, Bild, Rerank)
und cached 5 Minuten. Die Wahl wird je Run in `runs.model_override` gespeichert (Migration 003) und
über `withModel()` auf alle Modellaufrufe angewendet; die Oberfläche merkt sie sich im Browser.

**Dependency Injection statt globaler Auflösung:** `ToolContext` und `ResearchContext` tragen jetzt den
Suchanbieter; `executeRun` nimmt `llm` und `search` entgegen. Dadurch braucht der Produktcode keine
Sonderpfade für Tests.

**Verifikation:** Typecheck ✓ · Lint ✓ · 128 Tests ✓ · Build ✓ · Smoke 8/8 ✓.
Neuer Konventionstest `AC-47-05` schlägt fehl, sobald wieder simulierende Klassen in `lib/`, `app/`
oder `components/` auftauchen.

### Verifikation
- `npm run typecheck` ✓
- `npm run lint` ✓ (keine Warnungen)
- `npm test` ✓ 114 Tests in 17 Dateien, ohne Netzwerk und ohne API-Key
- `npm run build` ✓
- `npm run test:smoke` ✓ 24 Prüfungen gegen den Produktionsbuild (Health, Chat-Run, Research-Run mit
  Trace/Quellen/Citations, Follow-up ohne neue Suche, Persistenz, Auto-Titel, Abbruch, Startseite)
- Manuell im Browser geprüft: Live-Trace, Quellenpanel, Citation-Sprung, Reload während/nach einem Run.

### Offen
V1/V2-Specs (`22, 23, 29, 32, 34, 35, 41, 44, 45, 46`) sind spezifiziert, aber nicht implementiert.
Vor ihrer Umsetzung sind die Kurzform-Specs ins Vollformat zu überführen.
