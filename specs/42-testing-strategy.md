---
id: 42-testing-strategy
title: Testing Strategy
phase: 6
milestone: MVP
status: done
depends_on: [47-provider-setup]
provides: [test_setup]
owner_modules: ["tests/*", "vitest.config.ts"]
complexity: M
---

# Testing Strategy

## Purpose
Definiert, wie die Anwendung geprüft wird — schnell, deterministisch und ohne Netzwerk oder API-Keys.

## Scope / Out of Scope
In Scope: Testarten, Fixtures, Ausführung, Gates.
Out of Scope: Browser-E2E (V1, ADR-007).

## User Story
„Als implementierender Agent möchte ich nach jeder Spec eine verlässliche Rückmeldung, ob alles noch funktioniert."

## Functional Requirements
- `FR-42-01` Tests MÜSSEN ohne Netzwerkzugriff und ohne API-Key laufen.
- `FR-42-02` Jede Spec MUSS mindestens einen Test je `AC-` besitzen.
- `FR-42-03` Integrationstests MÜSSEN Route-Handler direkt aufrufen (kein laufender Server nötig).
- `FR-42-04` Ein Smoke-Test MUSS den Produktionsbuild starten und den vollständigen Research-Flow über HTTP/SSE prüfen.
- `FR-42-05` Jede DB-Nutzung im Test MUSS eine frische In-Memory-Datenbank verwenden.
- `FR-42-07` Test-Doubles DÜRFEN ausschließlich unter `tests/` liegen; der Anwendungscode DARF keine
  simulierten Antworten enthalten (ADR-013).
- `FR-42-06` Die Gesamtlaufzeit der Unit- und Integrationstests SOLL ≤ 60 s bleiben.

## Expected Behavior
Struktur: `tests/unit` (reine Funktionen), `tests/integration` (Orchestrator, API, DB),
`tests/smoke` (Produktionsbuild über HTTP), `tests/doubles` (Test-Doubles und Stub-Server).
Ein globaler Stub-Server (ADR-014) beantwortet `/v1/chat/completions`, `/v1/models`, die Tavily-Suche
und liefert Testseiten aus; die Suite richtet `LLM_BASE_URL` und `TAVILY_BASE_URL` darauf aus.
Damit läuft im Test derselbe Provider-Code wie in Produktion.
Skripte: `npm test`, `npm run test:watch`, `npm run typecheck`, `npm run lint`, `npm run verify`
(`typecheck && lint && test && build`).

## User Flow
Nicht zutreffend.

## System Flow
Vitest mit `node`-Umgebung; DOM-Tests nur für reine Reducer/Utility-Funktionen (kein React-Renderer nötig).

## Agent Behavior
Nicht zutreffend.

## Contracts
Test-Helfer in `tests/helpers/`: `makeRepos()`, `runFixtureRun()`, `collectEvents()`.

## API Requirements / Data Model / UI Requirements / States
Nicht zutreffend.

## Telemetry & Events
Tests dürfen keine Logs auf `info` ausgeben (`LOG_LEVEL=error`).

## Configuration
`vitest.config.ts` mit `setupFiles: ['tests/setup.ts']`.

## Edge Cases
1. Test hängt (offener Handle) → globaler Timeout 20 s je Test.
2. Zeitabhängiger Test → feste Zeitbasis über `vi.setSystemTime`.
3. Zufällige IDs → deterministisch über gesetzten Seed, wo relevant.
4. Paralleles Schreiben in dieselbe DB → jede Suite erhält eine eigene In-Memory-DB.

## Error Handling
Fehlgeschlagene Tests blockieren die Definition of Done jeder Spec.

## Security Considerations
Keine echten Keys in Fixtures; ein Test prüft, dass `.env*` nicht eingecheckt ist.

## Performance Budget
Siehe FR-42-06.

## Test Plan
Diese Spec ist der Testplan.

## Acceptance Criteria
- `AC-42-01` Given ein Rechner ohne Netzwerk, When `npm test`, Then laufen alle Tests grün. (FR-42-01)
- `AC-42-02` Given `npm run verify`, Then laufen Typecheck, Lint, Tests und Build ohne Fehler. (FR-42-04)
- `AC-42-03` Given der Smoke-Test, Then liefert er eine Antwort mit ≥ 1 Citation über HTTP. (FR-42-04)

## Definition of Done
`npm run verify` läuft lokal vollständig grün.

## Dependencies
47.

## Implementation Notes
Der Smoke-Test startet den Stub-Server und `next start` auf freien Ports, richtet die Anbieter-URLs
darauf aus und beendet beide in `afterAll`.

## Open Decisions
Coverage-Schwellen bewusst nicht erzwungen; stattdessen AC-Abdeckung.
