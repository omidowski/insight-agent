# Insight Agent — autonomer AI Research Agent

Web-App mit einem autonomen Recherche-Agenten: Der Nutzer chattet, der Agent erkennt selbst, ob eine
Recherche nötig ist, plant sie, sucht im Web, liest Quellen, vergleicht Angaben, erkennt Widersprüche
und liefert eine Antwort, in der **jede faktische Aussage zur Quelle zurückverfolgbar** ist.

Die Anwendung ist vollständig aus den Spezifikationen unter [`specs/`](specs/INDEX.md) implementiert.

## Schnellstart

```bash
npm install
npm run set-key      # OpenAI ("sk-…") oder NVIDIA ("nvapi-…"), Eingabe bleibt unsichtbar
npm run dev
```

`set-key` erkennt den Anbieter am Präfix, schreibt ihn nach `.env.local` (Rechte 600) und prüft ihn
anschließend mit `npm run check:llm`.

**Die Anwendung erzeugt keine simulierten Antworten.** Ohne konfigurierten Anbieter zeigt sie einen
Einrichtungshinweis und sperrt das Senden (ADR-013). Für Recherche wird zusätzlich ein Suchanbieter
benötigt: `BRAVE_API_KEY` oder `TAVILY_API_KEY` — außer bei OpenAI, dessen gehostete Websuche genutzt wird.

## Anbieter und Modelle

| Anbieter | Konfiguration | Websuche |
|---|---|---|
| OpenAI | `OPENAI_API_KEY` | gehostet, kein Zusatzschlüssel nötig |
| NVIDIA NIM | `NVIDIA_API_KEY` | benötigt Brave oder Tavily |
| Beliebig OpenAI-kompatibel (Groq, Together, OpenRouter, Ollama, vLLM) | `LLM_BASE_URL` + `LLM_API_KEY` | benötigt Brave oder Tavily |

Das Modell wählst du in der Kopfzeile der App: Empfehlungen zuerst, darunter alle Modelle, die dein
Konto tatsächlich freigeschaltet hat (`GET /api/models`). Die Wahl gilt je Run und bleibt gespeichert.

## Prüfen

```bash
npm run verify
```

Führt Typecheck, Lint, 127 Unit-/Integrationstests, Produktionsbuild und den HTTP-Smoke-Test aus.
Die Tests laufen ohne Schlüssel und ohne Netzwerk: Ein lokaler Stub-Server spricht die echten
Anbieterprotokolle, sodass der Produktcode unverändert durchlaufen wird (ADR-014).

Einzeln: `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` · `npm run test:smoke`

## Architektur

```
components/          React-Client (rein darstellend)
app/api/*            Route Handler: Validierung, Rate Limit, Serialisierung
lib/agent/           Router, Planner, Orchestrator, Research-Loop, State, Prompts, Safety
lib/tools/           Registry, Executor mit Guards, Web-Tools, Utilities
lib/llm/ lib/search/ Austauschbare Provider (OpenAI, OpenAI-kompatibel, Brave, Tavily)
lib/db/              node:sqlite, Migrationen, Repositories
lib/contracts/       Typen, Zod-Schemas, Event-Union, Fehlercodes
specs/               Verbindliche Spezifikationen (Quelle der Wahrheit)
tests/doubles/       Test-Doubles und Stub-Server (nur Tests, nie Produktion)
```

Die Agentenlogik läuft ausschließlich serverseitig und ist framework-unabhängig testbar.

## Kernentscheidungen

| Thema | Entscheidung | ADR |
|---|---|---|
| Persistenz | `node:sqlite` hinter Repository-Interface (kein ORM, keine native Abhängigkeit) | ADR-002 |
| Streaming | SSE über persistierte Events mit Replay und `Last-Event-ID`-Resume | ADR-003 |
| Tools | Eigene Tool-Schicht statt gehosteter Agent-Tools — nötig für Trace, Quellen und Kostenkontrolle | ADR-004 |
| Keine Simulation | Kein Demo-Modus; ohne Anbieter verweigert die App die Antwort | ADR-013 |
| Zweiter Anbieter | OpenAI-kompatible Chat Completions (NVIDIA NIM u. a.) | ADR-012 |
| Tests | Lokaler HTTP-Stub statt Fakes im Produktcode | ADR-014 |
| Abbruch | persistent in `runs.cancel_requested` plus In-Process-Signal | ADR-011 |

Alle Entscheidungen: [`specs/DECISIONS.md`](specs/DECISIONS.md).

## Sicherheit

- **Untrusted Content**: Webinhalte gehen ausschließlich als abgegrenzte Datenblöcke ins Modell;
  Anweisungen darin werden nicht befolgt, erkannte Injektionsversuche werden geloggt und im Trace gemeldet.
- **SSRF-Guard**: Schema-Allowlist, DNS-Auflösung, Blockliste für private/Loopback/Link-Local/Metadata-Ziele,
  erneute Prüfung nach jedem Redirect. Loopback nur im Demo-Modus.
- **Rendering**: Markdown wird sanitisiert (kein rohes HTML), Links mit `rel="noopener noreferrer"`.
- **Kein URL-Folgen aus Seiteninhalten**, `robots.txt` wird respektiert, Ratelimit je Zieldomain.
- **Budgets**: Iterationen, Suchen, Quellen, Zeit, Token und Kosten sind hart begrenzt.

## Stand

MVP vollständig: chatten · normale Fragen ohne Research-Overhead · Rechercheaufträge · Live-Fortschritt ·
Websuche · mehrere Quellen · nachvollziehbare Citations · Follow-ups mit Kontext · Abbruch ·
persistente Conversations · Modellauswahl · zwei Anbieterfamilien.

Offen (V1/V2): Authentifizierung, Dokumenten-Upload und Retrieval, Berichtserstellung, Code-Ausführung,
durable Background-Jobs, Export/Sharing, Eval-Harness — jeweils spezifiziert unter `specs/`.
