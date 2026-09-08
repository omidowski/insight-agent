---
id: 47-provider-setup
title: Provider Setup & Konfigurationszustand
phase: 1
milestone: MVP
status: done
depends_on: [43-configuration-and-environments, 05-shared-contracts]
provides: [provider_resolution, setup_state]
owner_modules: ["lib/config/env.ts", "lib/llm/index.ts", "lib/search/index.ts"]
complexity: M
---

# Provider Setup & Konfigurationszustand

## Purpose
Legt fest, wie die Anwendung ihren LLM- und Suchanbieter auflöst und wie sie sich verhält, solange
nichts konfiguriert ist. Ersetzt den früheren Demo-Modus: **Die Anwendung erzeugt unter keinen
Umständen simulierte Antworten oder erfundene Quellen** (ADR-013).

## Scope / Out of Scope
In Scope: Auflösung von `LLM_PROVIDER`, Erkennung fehlender Konfiguration, Verhalten und Meldungen
im nicht konfigurierten Zustand, Trennung von Modell- und Suchkonfiguration.
Out of Scope: Modellauswahl durch den Nutzer (Spec 48), Testaufbau (Spec 42).

## User Story
„Als Betreiber möchte ich sofort erkennen, ob die Anwendung einsatzbereit ist, und im Fehlerfall genau
erfahren, was fehlt — statt eine scheinbar funktionierende Antwort zu bekommen."

## Functional Requirements
- `FR-47-01` Die Anwendung DARF keine simulierten Modellantworten und keine erfundenen Quellen erzeugen.
- `FR-47-02` `LLM_PROVIDER=auto` MUSS den Anbieter aus den vorhandenen Schlüsseln ableiten:
  `OPENAI_API_KEY` → `openai`, sonst `NVIDIA_API_KEY` → `nvidia`, sonst `LLM_API_KEY` + `LLM_BASE_URL`
  → `compatible`, sonst `none`.
- `FR-47-03` Ein explizit gesetzter Anbieter ohne zugehörigen Schlüssel MUSS den Start mit klarer
  Meldung abbrechen.
- `FR-47-04` Ohne Anbieter (`none`) MUSS jede Ausführung mit `LLM_NOT_CONFIGURED` abgelehnt werden;
  die Oberfläche MUSS einen Einrichtungshinweis zeigen und das Senden sperren.
- `FR-47-05` Modell- und Suchkonfiguration MÜSSEN getrennt bewertet werden: Ein Anbieter ohne Websuche
  erlaubt Konversation, aber keine Recherche (`SEARCH_NOT_CONFIGURED`).
- `FR-47-06` `GET /api/health` MUSS `configured`, `provider`, `model` und `searchConfigured` ausweisen.
- `FR-47-07` Der SSRF-Guard DARF Loopback-Ziele nur bei ausdrücklich gesetztem `ALLOW_LOOPBACK_FETCH`
  zulassen (nur für automatisierte Tests vorgesehen).

## Expected Behavior
| Zustand | Verhalten |
|---|---|
| Kein Schlüssel | Banner „Kein Sprachmodell konfiguriert", Senden gesperrt, `/api/health` `configured: false` |
| Modell ja, Suche nein | Konversation möglich; Rechercheanfragen enden mit `SEARCH_NOT_CONFIGURED` |
| Modell und Suche vorhanden | Voller Betrieb |
| Falsch gesetzter Anbieter | Start bricht mit Variablenname ab |

## User Flow
Nutzer öffnet die App → sieht bei fehlender Konfiguration den Hinweis samt Befehl `npm run set-key`
→ trägt Schlüssel ein → startet neu → Banner verschwindet.

## System Flow
`getConfig()` löst den Anbieter auf und friert das Ergebnis ein. `getLLMProvider()` und
`getSearchProvider()` werfen bei fehlender Konfiguration eine `AppError`-Envelope mit Handlungshinweis.

## Agent Behavior
Nicht zutreffend — betrifft die Einrichtung, nicht die Agentenlogik.

## Contracts
`LlmProviderName = 'openai' | 'nvidia' | 'compatible' | 'none'`, `AppConfig.isConfigured`.

## API Requirements
`GET /api/health` (siehe FR-47-06).

## Data Model
Keine eigenen Tabellen.

## UI Requirements
Warnbanner bei fehlendem Modell, dezenter Hinweis bei fehlender Suche, Senden-Schaltfläche gesperrt.

## States
`configured` · `model_only` · `not_configured`.

## Telemetry & Events
Beim Start wird der aufgelöste Anbieter einmal geloggt (ohne Schlüssel).

## Configuration
`LLM_PROVIDER`, `OPENAI_API_KEY`, `NVIDIA_API_KEY`, `LLM_API_KEY`, `LLM_BASE_URL`,
`BRAVE_API_KEY`, `TAVILY_API_KEY`, `ALLOW_LOOPBACK_FETCH`.

## Edge Cases
1. Mehrere Schlüssel gesetzt → `auto` bevorzugt OpenAI; explizite Wahl gewinnt.
2. Gültiger Schlüssel ohne Guthaben → Start gelingt, Anfragen scheitern mit klarer Meldung (Spec 06).
3. Anbieter ohne gehostete Suche (NVIDIA) und ohne Brave/Tavily → Recherche nicht möglich, Konversation schon.
4. `ALLOW_LOOPBACK_FETCH` versehentlich in Produktion gesetzt → Guard protokolliert eine Warnung.
5. Schlüssel wird zur Laufzeit geändert → wirkt erst nach Neustart (Konfiguration ist eingefroren).

## Error Handling
`LLM_NOT_CONFIGURED` und `SEARCH_NOT_CONFIGURED` sind nicht `retryable` und nennen die zu setzende Variable.

## Security Considerations
Schlüssel werden nie geloggt oder ausgeliefert; `/api/health` gibt nur Namen und Zustände zurück.
`npm run set-key` schreibt mit Dateirechten `600`.

## Performance Budget
Auflösung ≤ 5 ms, nur beim ersten Zugriff.

## Test Plan
`tests/unit/config-logger.test.ts` (Auflösung, Fehlerfälle), `tests/smoke/smoke.test.ts` (Health).

## Acceptance Criteria
- `AC-47-01` Given kein Schlüssel, When `getConfig()` läuft, Then `isConfigured === false` und `llmProvider === 'none'`. (FR-47-02)
- `AC-47-02` Given `LLM_PROVIDER=nvidia` ohne `NVIDIA_API_KEY`, Then bricht der Start mit dem Variablennamen ab. (FR-47-03)
- `AC-47-03` Given `NVIDIA_API_KEY`, Then ist `llmProvider === 'nvidia'` und ein Standardmodell gesetzt. (FR-47-02)
- `AC-47-04` Given konfigurierten Betrieb, When `/api/health`, Then enthält die Antwort `configured`, `provider`, `model`, `searchConfigured`. (FR-47-06)
- `AC-47-05` Given den gesamten Quellcode von `lib/` und `app/`, Then existiert keine Klasse, die Modell- oder Suchantworten simuliert. (FR-47-01)

## Definition of Done
Tests grün; keine Fixture-Provider im Anwendungscode.

## Dependencies
05, 43.

## Implementation Notes
Test-Doubles liegen ausschließlich unter `tests/doubles/` und werden über einen HTTP-Stub eingebunden
(ADR-014), nicht über Sonderpfade im Produktcode.

## Open Decisions
Keine.
