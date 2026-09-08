---
id: 38-error-handling-and-resilience
title: Error Handling & Resilience
phase: 6
milestone: MVP
status: done
depends_on: [05-shared-contracts]
provides: [error_policy]
owner_modules: ["lib/util/errors.ts"]
complexity: M
---

# Error Handling & Resilience

## Purpose
Ein einheitliches Fehlerregime: Nutzer sehen verständliche Meldungen, Entwickler vollständige Diagnosen,
und Teilfehler beenden nie den ganzen Run.

## Scope / Out of Scope
In Scope: Envelope, Klassifikation, Retry, Fallbacks, Nutzermeldungen.
Out of Scope: Anzeige (Spec 10), Logging (Spec 40).

## User Story
„Als Nutzer möchte ich bei einem Fehler wissen, was passiert ist und was ich tun kann."

## Functional Requirements
- `FR-38-01` Jeder Fehler MUSS als `AppError` mit `code`, `message`, `userMessage`, `retryable` vorliegen.
- `FR-38-02` `userMessage` MUSS deutsch, konkret und ohne Interna sein.
- `FR-38-03` Retry MUSS nur bei `retryable` erfolgen, mit exponentiellem Backoff und Jitter, maximal 2 Wiederholungen.
- `FR-38-04` Teilfehler (Quelle, Tool, Schritt) DÜRFEN den Run nicht beenden.
- `FR-38-05` Jeder Run MUSS in einem Endstatus enden, auch bei unerwarteten Ausnahmen.
- `FR-38-06` Unerwartete Fehler MÜSSEN mit `INTERNAL` und einer Korrelations-ID ausgegeben werden.

## Expected Behavior
Nutzermeldungen (Beispiele):
| Code | userMessage |
|---|---|
| `LLM_UNAVAILABLE` | „Das Sprachmodell ist gerade nicht erreichbar. Bitte versuche es erneut." |
| `SEARCH_FAILED` | „Die Websuche ist fehlgeschlagen. Ich habe mit den vorhandenen Quellen weitergearbeitet." |
| `FETCH_BLOCKED` | „Diese Quelle konnte aus Sicherheitsgründen nicht geöffnet werden." |
| `BUDGET_EXCEEDED` | „Das Budget für diese Recherche ist erreicht. Hier ist das Zwischenergebnis." |
| `RATE_LIMITED` | „Zu viele Anfragen. Bitte warte einen Moment." |
| `RUN_CANCELLED` | „Die Recherche wurde abgebrochen." |
| `INTERNAL` | „Da ist etwas schiefgelaufen. Kennung: {correlationId}" |

## User Flow
Fehlerhafte Antwort zeigt Meldung plus „Erneut versuchen"; Teilfehler erscheinen nur im Trace.

## System Flow
`toAppError(unknown)` an jeder Systemgrenze; `withRetry(fn, policy)` für externe Aufrufe.

## Agent Behavior
Bei Teilfehlern beschreibt der Agent in der Antwort, welche Informationen fehlen.

## Contracts
`AppError` (Spec 05).

## API Requirements
Fehlerformat aus Spec 08.

## Data Model
`runs.error_json`.

## UI Requirements
Fehlerzustand je Nachricht, nicht global.

## States
Nicht zutreffend.

## Telemetry & Events
`run.failed`, `tool.call.failed`; Metrik: Fehlerquote je Code.

## Configuration
`RETRY_MAX_ATTEMPTS` (2), `RETRY_BASE_MS` (250).

## Edge Cases
1. Fehler im Fehlerpfad → letzte Instanz loggt und schließt den Run als `failed`.
2. Abbruch während eines Retrys → kein weiterer Versuch.
3. Fehler nach bereits gestreamtem Text → Teiltext bleibt, Status `failed`.
4. Mehrere gleichzeitige Teilfehler → gesammelt, nicht einzeln als Toast.
5. Nicht-Error-Wurf (String, Objekt) → in `INTERNAL` gewandelt.

## Error Handling
Diese Spec ist die Referenz.

## Security Considerations
Keine Stacktraces, Pfade oder Keys in `userMessage` oder API-Antworten.

## Performance Budget
Fehlerbehandlung ≤ 1 ms.

## Test Plan
`tests/unit/errors.test.ts`: Normalisierung, Retry-Zählung, Backoff, keine Interna in `userMessage`.

## Acceptance Criteria
- `AC-38-01` Given ein geworfener String, Then liefert `toAppError` `INTERNAL` mit `userMessage`. (FR-38-06)
- `AC-38-02` Given ein `retryable: false`-Fehler, Then erfolgt kein Retry. (FR-38-03)
- `AC-38-03` Given eine Ausnahme in der Synthese, Then endet der Run in `failed` mit Nutzermeldung. (FR-38-05)
- `AC-38-04` Given `userMessage`, Then enthält sie keinen Dateipfad und kein `sk-`. (Security)

## Definition of Done
Fehler-Tests grün; alle Codes haben eine deutsche Nutzermeldung.

## Dependencies
05.

## Implementation Notes
Meldungstabelle in `lib/util/errors.ts`, damit Übersetzungen später zentral möglich sind.

## Open Decisions
Keine.
