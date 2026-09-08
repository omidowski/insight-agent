---
id: 08-api-surface
title: API Surface
phase: 2
milestone: MVP
status: done
depends_on: [04-data-model-and-database, 05-shared-contracts, 09-streaming-protocol]
provides: [http_api]
owner_modules: ["app/api/*"]
complexity: M
---

# API Surface

## Purpose
Definiert alle HTTP-Endpunkte vollständig, damit Client und Backend unabhängig implementierbar sind.

## Scope / Out of Scope
In Scope: Endpunkte, Payloads, Statuscodes, Validierung, Fehlerformat.
Out of Scope: Fachlogik der jeweiligen Features.

## User Story
„Als Frontend möchte ich stabile, typisierte Endpunkte mit einheitlichem Fehlerformat."

## Functional Requirements
- `FR-08-01` Jeder Handler MUSS Eingaben per Zod validieren; Fehler → `400` mit `VALIDATION_FAILED`.
- `FR-08-02` Fehlerantworten MÜSSEN die `AppError`-Envelope verwenden.
- `FR-08-03` Alle Handler MÜSSEN `runtime = 'nodejs'` verwenden.
- `FR-08-04` Handler enthalten keine Agentenlogik, sondern delegieren an `lib/`.
- `FR-08-05` Mutierende Endpunkte MÜSSEN das Rate Limit aus Spec 36 anwenden.

## Expected Behavior
| Methode | Pfad | Body / Query | Antwort |
|---|---|---|---|
| GET | `/api/health` | – | `{ ok, demoMode, model, dbOk, version }` |
| GET | `/api/conversations` | – | `{ conversations: ConversationSummary[] }` |
| POST | `/api/conversations` | `{ title? }` | `201 { conversation }` |
| GET | `/api/conversations/:id` | – | `{ conversation, messages, sources }` |
| PATCH | `/api/conversations/:id` | `{ title }` | `{ conversation }` |
| DELETE | `/api/conversations/:id` | – | `204` |
| POST | `/api/runs` | `{ conversationId?, message, mode? }` | `202 { runId, conversationId, userMessageId }` |
| GET | `/api/runs/:id` | – | `{ run, steps, sources, conflicts, toolCalls }` |
| GET | `/api/runs/:id/events` | `?after=` | SSE (Spec 09) |
| POST | `/api/runs/:id/cancel` | – | `{ run }` |
| GET | `/api/demo/pages/:slug` | – | HTML (nur Demo) |

`mode`: `auto` (Default) \| `chat` \| `research` — erzwingt den Pfad und überschreibt den Router.

Fehlerformat:
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "…", "userMessage": "…", "retryable": false } }
```
Statuscodes: 200/201/202/204 · 400 Validierung · 401 fehlende Auth (wenn aktiviert) · 404 unbekannt ·
409 Konflikt (z. B. Abbruch eines beendeten Runs) · 429 Rate Limit · 500 intern.

## User Flow
Nicht zutreffend.

## System Flow
`withApi(handler)` kapselt Validierung, Nutzerauflösung, Rate Limit, Fehlerabbildung und Logging.

## Agent Behavior
`POST /api/runs` erzeugt die User-Message und den Run und startet die Ausführung asynchron (ADR-006).

## Contracts
Request-/Response-Schemas in `lib/contracts/schemas.ts`.

## API Requirements
Siehe Tabelle.

## Data Model
Siehe Spec 04.

## UI Requirements
Nicht zutreffend.

## States
Nicht zutreffend.

## Telemetry & Events
Zugriffslog je Anfrage: Methode, Pfad, Status, Dauer, `run_id`, ohne Body.

## Configuration
Keine eigene.

## Edge Cases
1. `POST /api/runs` ohne `conversationId` → neue Conversation wird angelegt.
2. Abbruch eines bereits beendeten Runs → `409`.
3. Unbekannte `conversationId` → `404`.
4. Nachricht > 20 000 Zeichen → `400` mit klarer Meldung.
5. Nachricht nur aus Leerzeichen → `400`.
6. Zwei parallele Runs in einer Conversation → erlaubt; die UI zeigt den neuesten.

## Error Handling
Unerwartete Fehler werden geloggt und als `INTERNAL` ohne Interna ausgeliefert.

## Security Considerations
Kein Echo unvalidierter Eingaben, keine Stacktraces im Body, JSON-Body-Limit 256 KB.

## Performance Budget
Nicht-streamende Endpunkte ≤ 100 ms (ohne Modellaufruf).

## Test Plan
`tests/integration/api.test.ts` ruft die Route-Handler direkt auf: Happy Path je Endpunkt,
Validierungsfehler, 404, 409, Rate Limit.

## Acceptance Criteria
- `AC-08-01` Given ungültiger Body, When `POST /api/runs`, Then `400` mit `VALIDATION_FAILED`. (FR-08-01)
- `AC-08-02` Given gültige Anfrage, When `POST /api/runs`, Then `202` mit `runId` in ≤ 300 ms. (FR-08-04)
- `AC-08-03` Given beendeter Run, When `POST /api/runs/:id/cancel`, Then `409`. (Edge 2)
- `AC-08-04` Given Löschung einer Conversation, Then `204` und `GET` liefert danach `404`. (FR-08-02)

## Definition of Done
API-Tests grün; alle Endpunkte implementiert.

## Dependencies
04, 05, 09.

## Implementation Notes
Nutzer im MVP: fester `local-user`, beim ersten Start angelegt.

## Open Decisions
Keine.
