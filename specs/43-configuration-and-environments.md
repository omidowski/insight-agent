---
id: 43-configuration-and-environments
title: Configuration & Environments
phase: 1
milestone: MVP
status: done
depends_on: [05-shared-contracts]
provides: [env_config]
owner_modules: ["lib/config/*"]
complexity: S
---

# Configuration & Environments

## Purpose
Zentralisiert und validiert alle Umgebungsvariablen, damit Fehlkonfiguration beim Start auffällt
und nicht mitten in einem Run.

## Scope / Out of Scope
In Scope: Env-Schema, Defaults, Feature-Flags, Modus-Erkennung.
Out of Scope: Deployment (Spec 44).

## User Story
„Als Betreiber möchte ich die App ohne Konfiguration starten können und bei falschen Werten sofort eine klare Meldung sehen."

## Functional Requirements
- `FR-43-01` Alle `process.env`-Zugriffe MÜSSEN in `lib/config/env.ts` liegen.
- `FR-43-02` Die Konfiguration MUSS per Zod validiert werden; ungültige Werte brechen den Start ab.
- `FR-43-03` Ohne Anbieterschlüssel MUSS `isConfigured` false sein; simulierte Antworten gibt es nicht (Spec 47).
- `FR-43-04` Kein Env-Wert DARF im Client-Bundle landen (keine `NEXT_PUBLIC_`-Secrets).

## Expected Behavior
| Variable | Default | Bedeutung |
|---|---|---|
| `OPENAI_API_KEY` | – | Aktiviert den Realbetrieb |
| `OPENAI_MODEL_FAST` | `gpt-5-mini` | Router, Extraktion, Planung |
| `OPENAI_MODEL_MAIN` | `gpt-5` | Synthese, Konversation |
| `LLM_PROVIDER` | `auto` | `auto\|openai\|nvidia\|compatible` |
| `SEARCH_PROVIDER` | `auto` | `auto\|openai\|brave\|tavily` |
| `BRAVE_API_KEY` / `TAVILY_API_KEY` | – | optionale Suchanbieter |
| `DATABASE_PATH` | `./data/app.db` | SQLite-Datei |
| `NVIDIA_API_KEY` / `NVIDIA_BASE_URL` | – / NIM-URL | NVIDIA NIM (ADR-012) |
| `LLM_API_KEY` / `LLM_BASE_URL` | – | beliebiger OpenAI-kompatibler Endpunkt |
| `BRAVE_BASE_URL` / `TAVILY_BASE_URL` | Anbieter-URL | überschreibbar für Proxy, Self-Hosting, Tests |
| `ALLOW_LOOPBACK_FETCH` | `false` | nur für automatisierte Tests |
| `AUTH_ENABLED` | `false` | Spec 34 |
| `MAX_RUN_COST_USD` | `0.5` | Kosten-Hardstop |
| `MAX_RUN_WALL_CLOCK_MS` | `180000` | Zeitbudget |
| `MAX_RESEARCH_ITERATIONS` | `3` | Loop-Grenze |
| `MAX_SEARCHES` / `MAX_SOURCES` | `12` / `15` | Recherchebudgets |
| `FETCH_TIMEOUT_MS` | `8000` | Seitenabruf |
| `RATE_LIMIT_RUNS_PER_HOUR` | `30` | Spec 36 |
| `LOG_LEVEL` | `info` | `debug\|info\|warn\|error` |

`getConfig()` ist gecacht und liefert ein eingefrorenes Objekt.

## User Flow
Nicht zutreffend.

## System Flow
Erster Zugriff validiert und cached; bei Fehlern wird eine Liste aller ungültigen Variablen geworfen.

## Agent Behavior
Budgets aus der Konfiguration werden beim Run-Start in `runs.budgets_json` eingefroren, damit spätere
Änderungen laufende Runs nicht beeinflussen.

## Contracts
`AppConfig` in `lib/config/env.ts`, Budgets aus Spec 05.

## API Requirements
`GET /api/health` liefert `{ ok, configured, provider, model, searchConfigured, dbOk, version }` ohne Secrets.

## Data Model
Nicht zutreffend.

## UI Requirements
Ist kein Anbieter konfiguriert, zeigt die UI ein Einrichtungsbanner und sperrt das Senden.

## States
Nicht zutreffend.

## Telemetry & Events
Beim Start wird die effektive Konfiguration ohne Secrets einmal geloggt.

## Configuration
Diese Spec ist die Referenz. `.env.example` liegt im Repo.

## Edge Cases
1. `MAX_RUN_COST_USD=abc` → Startfehler mit Variablenname.
2. Key gesetzt, aber ungültig → Realmodus, erster Modellaufruf schlägt fehl → `LLM_UNAVAILABLE`, UI-Hinweis.
3. `SEARCH_PROVIDER=brave` ohne Key → Startfehler.
4. Tests → `LLM_BASE_URL` zeigt auf den Stub-Server, `DATABASE_PATH=:memory:` (ADR-014).

## Error Handling
Konfigurationsfehler = Startabbruch mit Exitcode 1 und lesbarer Meldung.

## Security Considerations
`env.ts` ist serverseitig; ein Test stellt sicher, dass keine Client-Komponente es importiert.

## Performance Budget
Validierung ≤ 5 ms, nur beim ersten Aufruf.

## Test Plan
`tests/unit/config-logger.test.ts`: Defaults, Validierungsfehler, Anbieterauflösung.

## Acceptance Criteria
- `AC-43-01` Given keine Env-Variablen, When `getConfig()` läuft, Then ist `isConfigured === false` und alle Defaults sind gesetzt. (FR-43-03)
- `AC-43-02` Given `MAX_RUN_COST_USD="x"`, When `getConfig()` läuft, Then wird ein Fehler mit dem Variablennamen geworfen. (FR-43-02)
- `AC-43-03` Given der Client-Bundle-Test, Then importiert keine Client-Komponente `lib/config/env`. (FR-43-04)

## Definition of Done
Config-Tests grün, `.env.example` vorhanden, `/api/health` liefert `ok`.

## Dependencies
05.

## Implementation Notes
Zahlenwerte über `z.coerce.number()`; Booleans akzeptieren `1|true|yes`.

## Open Decisions
Modellnamen sind konfigurierbar, damit neue Modellversionen ohne Codeänderung nutzbar sind.
