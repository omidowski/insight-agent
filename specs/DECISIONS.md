# Architecture Decision Records

## ADR-001 — Next.js (App Router) + TypeScript strict
**Entscheidung:** Next.js mit App Router, React 19, TypeScript `strict`, Tailwind CSS v4.
**Alternativen:** Vite+Express (mehr Boilerplate), Remix (kleineres Ökosystem für RSC/Streaming).
**Begründung:** Ein Deployment-Artefakt für UI und API, natives Streaming über Route Handlers, große Toolchain-Reife.
**Auswirkung bei Änderung:** Betrifft nur `app/` und `components/`; `lib/` ist framework-unabhängig.

## ADR-002 — Persistenz: SQLite über `node:sqlite`, Repository-Interface
**Entscheidung:** Datenzugriff über ein `Repositories`-Interface; MVP-Implementierung mit dem in Node
eingebauten `node:sqlite` und SQL-Migrationsdateien. Kein ORM, keine nativen Abhängigkeiten.
**Alternativen:** Postgres+Drizzle (Default des Auftrags), better-sqlite3.
**Begründung:** Zero-Setup und zero Build-Risiko; die App ist ohne Infrastruktur lauffähig und testbar,
was für die MVP-Abnahme entscheidend ist. Das Interface erlaubt einen Postgres-Adapter ohne Logikänderung.
**Auswirkung bei Änderung:** Neuer Adapter unter `lib/db/adapters/`, Migrationsdialekt anpassen. Kein Aufrufer betroffen.

## ADR-003 — Streaming über SSE mit persistierten Events und Polling-Reader
**Entscheidung:** Der Orchestrator schreibt Events in die Tabelle `run_events`; der SSE-Endpunkt liest
sie ab `seq > after` und pollt im 120-ms-Takt. `Last-Event-ID` wird unterstützt.
**Alternativen:** In-Memory-Bus (kein Replay), WebSockets (mehr Infrastruktur).
**Begründung:** Replay nach Reload, Resume nach Verbindungsabbruch und Debugbarkeit ohne zusätzliche Infrastruktur.
**Auswirkung bei Änderung:** Ein In-Memory-Bus kann als Beschleunigung ergänzt werden; das Protokoll bleibt gleich.

## ADR-004 — Eigene Tool-Schicht statt ausschließlich gehosteter Agent-Tools
**Entscheidung:** Suche, Seitenabruf und Extraktion laufen als eigene Tools im Backend.
**Alternativen:** Vollständig gehostete Tool-Ausführung beim Modellanbieter.
**Begründung:** Nur so entstehen die geforderten sichtbaren Execution-Trace-Events, prüfbare Quellen,
Kostenkontrolle und Provider-Austauschbarkeit.
**Auswirkung bei Änderung:** Der gehostete Web-Search-Pfad bleibt als `SearchProvider`-Implementierung nutzbar.

## ADR-005 — Demo-Modus mit deterministischen Fixture-Providern
**Entscheidung:** Ohne `OPENAI_API_KEY` startet die App im Demo-Modus: `FixtureLLMProvider`,
`FixtureSearchProvider` und lokal ausgelieferte Fixture-Seiten unter `/api/demo/pages/*`.
**Alternativen:** App verweigert den Start ohne Key.
**Begründung:** Die gesamte Pipeline (Router → Plan → Suche → Lesen → Extraktion → Vergleich → Synthese →
Citations → Streaming-UI) ist damit ohne Key und ohne Netzwerk deterministisch ausführbar und automatisiert testbar.
**Sicherheitsauflage:** Der SSRF-Guard erlaubt Localhost-Ziele ausschließlich, wenn `DEMO_MODE` aktiv ist.

## ADR-006 — Run-Ausführung im Node-Prozess, Zustand nach jedem Schritt persistiert
**Entscheidung:** `POST /api/runs` startet die Ausführung asynchron im selben Prozess und antwortet sofort
mit `runId`. Nach jedem Schritt werden State und Events geschrieben.
**Alternativen:** Job-Queue (Inngest/Redis) ab Tag 1.
**Begründung:** Ausreichend für Runs < 180 s und einen Prozess; Persistenz erhält Nachvollziehbarkeit.
**Auswirkung bei Änderung:** Spec 45 ersetzt den Starter durch einen Worker; die Orchestrator-API bleibt gleich.

## ADR-007 — Tests: Vitest + Fixture-Provider, HTTP-Smoke-Test statt Browser-E2E im MVP
**Entscheidung:** Unit- und Integrationstests mit Vitest gegen die Route-Handler und den Orchestrator;
ein Smoke-Test fährt den Produktionsbuild hoch und prüft den kompletten Research-Flow über HTTP/SSE.
**Alternativen:** Playwright ab Tag 1.
**Begründung:** Deckt die Kernrisiken (Pipeline, Streaming, Citations) ohne 300 MB Browser-Download ab.
**Auswirkung bei Änderung:** Playwright ergänzt Spec 42 in Phase 6/8.

## ADR-008 — Zod als einzige Schema-Quelle
**Entscheidung:** Tool-Parameter, API-Payloads, Structured Outputs und Events werden einmal in Zod
definiert; TypeScript-Typen werden abgeleitet, JSON-Schemas für das Modell generiert.
**Begründung:** Verhindert Divergenz zwischen Modellvertrag, API-Vertrag und DB-Vertrag.

## ADR-009 — Migrationen als TypeScript-Modul statt loser .sql-Dateien
**Entscheidung:** Die Migrations-SQL liegt in `lib/db/migrations.ts` als Array `{ name, sql }`.
**Alternative:** `.sql`-Dateien zur Laufzeit über `fs` lesen (ursprünglicher Plan in Spec 04).
**Begründung:** Next.js bündelt Servercode; ein Laufzeit-`fs`-Zugriff auf Projektdateien ist je nach
Build- und Deploymentvariante nicht garantiert. Das TS-Modul ist immer Teil des Bundles.
**Auswirkung bei Änderung:** Ein Postgres-Adapter bringt seine eigene Migrationsliste im selben Format mit.

## ADR-010 — Fixture-Route unter `/api/demo/pages/[slug]`
**Entscheidung:** Die Demo-Seiten werden unter `/api/demo/pages/[slug]` ausgeliefert (ursprünglich `/api/__fixtures/...`).
**Begründung:** Verzeichnisse mit `_`-Präfix sind im Next.js App Router private Ordner und erzeugen keine Route.
**Auswirkung bei Änderung:** Nur `fixtureUrl()` in `lib/fixtures/pages.ts` und der Testserver.

## ADR-011 — Abbruch zusätzlich persistent über `runs.cancel_requested`
**Entscheidung:** `POST /api/runs/:id/cancel` setzt ein persistentes Flag; der Orchestrator prüft es vor
jedem Schritt und über einen 250-ms-Watcher, zusätzlich zur In-Process-Registry.
**Alternative:** Nur die In-Process-`Map` (ursprünglicher Plan).
**Begründung:** Der Smoke-Test zeigte, dass Next.js Route-Handler in getrennten Modulinstanzen laufen
können — die Registry des Cancel-Handlers war dann leer und der Abbruch wirkungslos.
**Auswirkung bei Änderung:** Spec 45 (Worker-Betrieb) baut auf demselben Flag auf.

## ADR-012 — Zweiter LLM-Anbieter über OpenAI-kompatible Chat Completions
**Entscheidung:** Neben `OpenAIProvider` (Responses API) gibt es `OpenAICompatibleProvider`, der gegen
`/chat/completions` spricht. Damit sind NVIDIA NIM, Groq, Together, OpenRouter und lokale Server
(Ollama, vLLM) nutzbar. Auswahl über `LLM_PROVIDER`; `auto` leitet aus den vorhandenen Schlüsseln ab.
**Alternativen:** Nur OpenAI (blockiert bei fehlendem Guthaben); ein Adapter-Framework (Overhead).
**Begründung:** Die Architektur sah Austauschbarkeit vor (Spec 02, FR-02-04); der Bedarf entstand real,
als das OpenAI-Konto ohne Guthaben war. Der neue Provider nutzt nur `fetch`, also keine weitere Abhängigkeit.
**Einschränkungen, ausdrücklich dokumentiert:**
- Structured Outputs laufen bei NVIDIA über `response_format: json_object` plus Schema-Hinweis im Prompt,
  mit Fallback-Reparatur — nicht über `json_schema` mit `strict`. Etwas höhere Fehlerquote als bei OpenAI.
- Die **gehostete Websuche gibt es nur bei OpenAI**. Mit NVIDIA braucht die Recherche einen
  `BRAVE_API_KEY` oder `TAVILY_API_KEY`; ohne einen davon fällt die Suche auf die Demo-Quellen zurück.
- Kostenschätzung: für unbekannte Modelle greift ein Fallback-Preis; bei kostenlosen Kontingenten
  sind die ausgewiesenen Kosten daher nur ein Richtwert.
**Auswirkung bei Änderung:** Weitere Anbieter benötigen nur einen Eintrag in `getLLMProvider()`.

## ADR-013 — Keine simulierten Antworten im Anwendungscode (ersetzt ADR-005)
**Entscheidung:** Der Demo-Modus und alle Fixture-Provider werden aus der Anwendung entfernt. Ohne
konfigurierten Anbieter antwortet die App nicht, sondern verlangt eine Einrichtung
(`LLM_NOT_CONFIGURED`, `SEARCH_NOT_CONFIGURED`).
**Alternative:** Demo-Modus beibehalten (ADR-005).
**Begründung:** Der Demo-Modus wurde wiederholt für einen Fehler gehalten: Die App schien zu antworten,
lieferte aber Vorlagentexte, und bei Rechercheanfragen zeitweise sogar fachfremde Quellen. Eine
Anwendung, die Inhalte erfinden kann, untergräbt genau das Versprechen dieses Produkts —
nachvollziehbare, belegte Antworten.
**Auswirkung:** `lib/llm/fixture.ts`, `lib/search/fixture.ts`, `lib/fixtures/` und `/api/demo/*` entfallen;
Spec 47 wurde von „Demo Mode" zu „Provider Setup" umgeschrieben. Der SSRF-Guard erlaubt Loopback nur
noch über den ausdrücklichen Testschalter `ALLOW_LOOPBACK_FETCH`.

## ADR-014 — Tests laufen gegen einen lokalen HTTP-Stub statt gegen Fakes im Produktcode
**Entscheidung:** `tests/doubles/stub-server.ts` implementiert die echten Protokolle
(`/v1/chat/completions`, `/v1/models`, Tavily-Suche, Testseiten). Die Testsuite richtet
`LLM_BASE_URL` und `TAVILY_BASE_URL` darauf aus.
**Alternativen:** Injektionsschalter im Produktcode; Tests gegen echte Anbieter.
**Begründung:** Die Anwendung durchläuft im Test denselben Provider-Code wie in Produktion — inklusive
HTTP, Streaming, Fehlerabbildung und SSRF-Guard. Gleichzeitig bleibt die Suite offline, deterministisch
und ohne Schlüssel lauffähig (Spec 42, FR-42-01).
**Nebeneffekt:** `BRAVE_BASE_URL` und `TAVILY_BASE_URL` sind jetzt konfigurierbar, was auch Proxys und
Self-Hosting ermöglicht.

## ADR-015 — Hermes-Agent-CLI als dritter Anbieterweg
**Entscheidung:** `LLM_PROVIDER=hermes` ruft die installierte Hermes-Agent-CLI als Unterprozess auf
(`hermes chat -q … --quiet --max-turns 1 --ignore-rules`). Hermes spricht seinerseits den in
`HERMES_PROVIDER` gewählten Anbieter an — für NVIDIA NIM den dort eingebauten Provider `nvidia`.
**Alternativen:** Direkter HTTP-Aufruf gegen NVIDIA (ADR-012, bleibt bestehen); `hermes proxy`
(unterstützt nur Nous Portal und xAI, nicht NVIDIA).
**Begründung:** Die Zugangsdaten liegen damit in `~/.hermes/.env` statt in der `.env.local` dieser
Anwendung — ein Schlüssel, eine Stelle, von Hermes verwaltet. Wer Hermes ohnehin eingerichtet hat,
braucht in diesem Projekt keinen Schlüssel mehr.
**Bewusst in Kauf genommen:**
- **Kein echtes Streaming.** Die CLI liefert die fertige Antwort; die App reicht sie in Stücken nach.
  Der Trace verhält sich gleich, der erste Text erscheint aber später.
- **Keine Verbrauchsdaten.** Token und Kosten werden geschätzt, die Budgets aus Spec 37 greifen
  dadurch weniger genau.
- **Ein Prozessstart je Modellaufruf.** Ein Research-Run macht viele Aufrufe; das ist spürbar
  langsamer als der HTTP-Weg.
- **Structured Outputs** entstehen über eine Schema-Anweisung im Prompt plus einen Reparaturversuch,
  nicht über erzwungene JSON-Schemata.
**Auswirkung bei Änderung:** Nur `lib/llm/hermes-cli.ts` und der Zweig in `getLLMProvider()`.

## ADR-016 — Websuche über Hermes' Werkzeugsatz, direkt statt über ein Modell
**Datum:** 2026-09-08 · **Status:** angenommen
**Kontext:** Die Websuche verlangte bisher BRAVE_API_KEY, TAVILY_API_KEY oder OpenAI. Ohne einen
davon blieb jede Frage nach tagesaktuellen Angaben unbeantwortet. Hermes bringt einen eigenen
Werkzeugsatz `web` mit, dessen Rückgriff `ddgs` (DuckDuckGo) ohne Konto arbeitet.
**Entscheidung:** `HermesSearchProvider` ruft Hermes' `web_search_tool` direkt in dessen
Python-Umgebung auf (`<HERMES_HOME>/hermes-agent/venv/bin/python3`) — nicht über `hermes chat`.
**Begründung:** Der Umweg über die Chat-CLI bräuchte selbst ein Sprachmodell, kostete Token und
wäre nicht reproduzierbar. Der direkte Aufruf ist deterministisch und schlüsselfrei.
**Sicherheit:** Die Suchanfrage wird als `argv`-Argument übergeben, nie in den Python-Quelltext
eingesetzt — sonst wäre sie ausführbarer Code. Der Aufruf läuft ohne Shell. Treffer sind DATEN;
Titel und Beschreibung werden gekürzt und unverändert weitergereicht.
**Bewusst in Kauf genommen:** DuckDuckGo drosselt wiederholte Anfragen und antwortet dann mit einer
leeren Trefferliste statt mit einem Fehler. Dagegen steht ein einmaliger Wiederholversuch nach
1,2 Sekunden. Wer bessere Ergebnisse braucht, hinterlegt in Hermes einen stärkeren Anbieter und
setzt HERMES_SEARCH_BACKEND.
**Voraussetzung:** Das Paket `ddgs` muss in Hermes' Umgebung installiert sein.
**Auswirkung bei Änderung:** Nur `lib/search/hermes.ts` und der Zweig in `getSearchProvider()`.

## ADR-017 — Tagesaktuelle Fragen umgehen die Modellentscheidung
**Datum:** 2026-09-08 · **Status:** angenommen
**Kontext:** Der Router stufte „Wie ist das Wetter in Hamburg?" mit einem schwächeren Modell als
`conversation` ein. Es wurde nicht gesucht — und das Modell erfand Quellen samt Messwerten.
**Entscheidung:** Zwei Muster (`LIVE_FACT`, `LIVE_TIME`) prüfen die Anfrage NEBEN dem Modell. Treffen
sie zu und hat der gewählte Pfad keine Recherche, wird auf `web_lookup` hochgestuft. Schlägt die
Klassifikation ganz fehl, führt der Rückfall bei solchen Fragen ebenfalls in die Websuche.
**Begründung:** Ob eine Frage tagesaktuelle Daten braucht, ist eine Eigenschaft der Frage, keine
Ermessensfrage des Modells. Eine erfundene Temperatur ist schlimmer als eine langsame Antwort.
**Ergänzend:** Der Gesprächs-Prompt untersagt ausdrücklich, Quellen, Messwerte, Zitate oder
Domainnamen zu erfinden.
**Bewusst in Kauf genommen:** Die Muster sind deutschsprachig plus einige englische Begriffe und
greifen gelegentlich zu weit — eine unnötige Suche kostet Zeit, eine erfundene Zahl kostet Vertrauen.
**Auswirkung bei Änderung:** Nur `needsLiveLookup()` in `lib/agent/router.ts`.

## ADR-018 — Denkschritt von Reasoning-Modellen abschalten
**Datum:** 2026-09-08 · **Status:** angenommen
**Kontext:** NVIDIA-Nemotron denkt vor jeder Antwort sichtbar nach. Gemessen: 39–52 Sekunden je
Aufruf. Ein Research-Run macht viele Aufrufe und lief dadurch zuverlässig ins Zeitlimit.
**Entscheidung:** Der OpenAI-kompatible Anbieter sendet `chat_template_kwargs: { thinking: false }`.
`LLM_DISABLE_THINKING` steuert das: `auto` (nur bei NVIDIA), `on`, `off`.
**Messung:** Dieselbe Anfrage fiel von 52 auf 13 Sekunden; `reasoning_content` kam als `null` zurück.
**Bewusst in Kauf genommen:** Für Zwischenschritte wie Auswertung und Klassifikation ist der
Denkschritt verzichtbar; bei der Schlussantwort kann die Qualität sinken. Wer das nicht will,
setzt `LLM_DISABLE_THINKING=off`. Andere Anbieter kennen den Schalter nicht — deshalb `auto`.
**Auswirkung bei Änderung:** Nur `thinkingOff()` in `lib/llm/openai-compatible.ts`.
