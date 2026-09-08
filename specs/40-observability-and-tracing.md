---
id: 40-observability-and-tracing
title: Observability & Tracing
phase: 6
milestone: MVP
status: done
depends_on: [09-streaming-protocol]
provides: [logging, metrics]
owner_modules: ["lib/util/logger.ts"]
complexity: M
---

# Observability & Tracing

## Purpose
Macht jeden Run im Nachhinein erklärbar: strukturierte Logs, Korrelation über `run_id`, Kennzahlen.

## Scope / Out of Scope
In Scope: Logger, Logfelder, Metriken, Debug-Ansicht eines Runs.
Out of Scope: Externe APM-Anbindung (V1).

## User Story
„Als Entwickler möchte ich zu einem Run genau nachvollziehen, was passiert ist."

## Functional Requirements
- `FR-40-01` Logs MÜSSEN strukturiertes JSON mit `ts, level, msg, runId?, conversationId?, module` sein.
- `FR-40-02` Jeder Modell- und Tool-Aufruf MUSS Dauer, Ergebnisgröße und Fehlercode protokollieren.
- `FR-40-03` Logs DÜRFEN keine Secrets, Rohprompts oder vollständigen Seiteninhalte enthalten.
- `FR-40-04` `GET /api/runs/:id` MUSS eine vollständige Rekonstruktion (Events, Schritte, Tool-Aufrufe,
  Quellen, Kosten) liefern.
- `FR-40-05` Der Loglevel MUSS konfigurierbar sein.

## Expected Behavior
Kennzahlen je Run: Dauer, Iterationen, Suchen, geöffnete Quellen, verwertbare Quellen, Konflikte,
Citations, Token, Kosten, Stoppgrund. Diese Werte stehen im `run.completed`-Event und im Log.

## User Flow
Entwickleransicht über `/api/runs/:id` (JSON); UI-Debugansicht optional (V1).

## System Flow
`logger.child({ runId })` wird durch Orchestrator, Tools und Provider gereicht.

## Agent Behavior
Nicht zutreffend.

## Contracts
`LogFields`.

## API Requirements
Siehe FR-40-04.

## Data Model
Nutzt vorhandene Tabellen.

## UI Requirements
Keine im MVP.

## States
Nicht zutreffend.

## Telemetry & Events
Diese Spec definiert sie.

## Configuration
`LOG_LEVEL`, `LOG_PRETTY` (Entwicklung).

## Edge Cases
1. Sehr großes Logfeld → auf 2 000 Zeichen gekürzt.
2. Zirkuläre Objekte → sicher serialisiert.
3. Log während des Prozessendes → synchrone Ausgabe auf stdout.
4. `LOG_LEVEL=debug` → Prompts weiterhin nicht im Klartext, nur Hashes und Längen.

## Error Handling
Loggingfehler dürfen die Anwendung nie beeinflussen.

## Security Considerations
Redaction-Filter für `sk-`, `Bearer `, `api_key`, E-Mail-Adressen.

## Performance Budget
Logaufruf ≤ 0,1 ms.

## Test Plan
`tests/unit/logger.test.ts`: Redaction, Kürzung, Level-Filter, JSON-Gültigkeit.

## Acceptance Criteria
- `AC-40-01` Given ein Log mit `sk-live-1`, Then erscheint der Wert nicht in der Ausgabe. (FR-40-03)
- `AC-40-02` Given `LOG_LEVEL=warn`, Then erscheinen keine `info`-Zeilen. (FR-40-05)
- `AC-40-03` Given ein abgeschlossener Run, When `GET /api/runs/:id`, Then enthält die Antwort Events,
  Schritte, Tool-Aufrufe, Quellen und Kosten. (FR-40-04)

## Definition of Done
Logger-Tests grün; alle Module nutzen den zentralen Logger.

## Dependencies
09.

## Implementation Notes
Kein Logging-Framework; ~60 Zeilen eigener Logger reichen und vermeiden eine Abhängigkeit.

## Open Decisions
OpenTelemetry-Export ist V1.
