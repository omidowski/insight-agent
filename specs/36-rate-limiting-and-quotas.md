---
id: 36-rate-limiting-and-quotas
title: Rate Limiting & Quotas
phase: 6
milestone: MVP
status: done
depends_on: [08-api-surface]
provides: [rate_limits]
owner_modules: ["lib/util/rate-limit.ts"]
complexity: S
---

# Rate Limiting & Quotas

## Purpose
Schützt Anwendung, Modellbudget und fremde Zielserver vor Überlastung und Missbrauch.

## Scope / Out of Scope
In Scope: Limits je Nutzer, Route und Zieldomain, Nebenläufigkeitsgrenze.
Out of Scope: Kostenbudgets je Run (Spec 37).

## User Story
„Als Betreiber möchte ich, dass ein Nutzer weder meine Kosten noch fremde Server überlastet."

## Functional Requirements
- `FR-36-01` `POST /api/runs` MUSS auf `RATE_LIMIT_RUNS_PER_HOUR` (30) je Nutzer begrenzt sein.
- `FR-36-02` Gleichzeitige Runs je Nutzer MÜSSEN auf `MAX_CONCURRENT_RUNS` (6) begrenzt sein.
- `FR-36-03` Abrufe je Zieldomain MÜSSEN auf 1 Anfrage/Sekunde begrenzt sein (laufübergreifend).
- `FR-36-04` Überschreitung MUSS `429` mit `RATE_LIMITED` und `Retry-After` liefern.
- `FR-36-05` Limits MÜSSEN konfigurierbar und in Tests deaktivierbar sein.

## Expected Behavior
Token-Bucket im Prozessspeicher (MVP, ADR: ausreichend für einen Prozess). Schlüssel:
`user:{id}:runs`, `user:{id}:concurrent`, `domain:{host}`.
Domain-Limit wird als Warteschlange umgesetzt (Verzögerung statt Ablehnung), maximal 3 s Wartezeit,
danach `TOOL_TIMEOUT`.

## User Flow
Bei Überschreitung erscheint eine klare Meldung mit Wartezeit.

## System Flow
`withApi` prüft Route-Limits; der Fetch-Pfad prüft Domain-Limits.

## Agent Behavior
Nicht zutreffend.

## Contracts
`RateLimitResult { allowed, remaining, resetAt }`.

## API Requirements
`429` mit `Retry-After` in Sekunden.

## Data Model
Keine Persistenz im MVP.

## UI Requirements
Fehlermeldung mit Wartezeit.

## States
Nicht zutreffend.

## Telemetry & Events
Log je Ablehnung mit Schlüssel und Restzeit.

## Configuration
`RATE_LIMIT_RUNS_PER_HOUR`, `MAX_CONCURRENT_RUNS`, `DOMAIN_RATE_LIMIT_MS` (1000), `RATE_LIMIT_ENABLED`.

## Edge Cases
1. Prozessneustart → Limits zurückgesetzt (dokumentierte Einschränkung).
2. Domain-Limit während paralleler Schritte → Anfragen werden serialisiert, nicht abgelehnt.
3. Abbruch während der Wartezeit → sofortiger Abbruch.
4. Tests → `RATE_LIMIT_ENABLED=false`.

## Error Handling
`RATE_LIMITED` ist `retryable: true`.

## Security Considerations
Limits sind zugleich Missbrauchs- und Kostenschutz; ohne Auth gilt `local-user` als einziger Schlüssel.

## Performance Budget
Prüfung ≤ 0,2 ms.

## Test Plan
`tests/unit/rate-limit.test.ts`: Bucket-Auffüllung, Ablehnung, Domain-Serialisierung, Abbruch.

## Acceptance Criteria
- `AC-36-01` Given 31 Runs in einer Stunde, Then liefert der 31. `429` mit `Retry-After`. (FR-36-01)
- `AC-36-02` Given zwei Abrufe derselben Domain, Then liegen ≥ 1000 ms dazwischen. (FR-36-03)
- `AC-36-03` Given `RATE_LIMIT_ENABLED=false`, Then greifen keine Limits. (FR-36-05)

## Definition of Done
Tests grün; Limits an allen mutierenden Routen aktiv.

## Dependencies
08.

## Implementation Notes
Für Mehrprozessbetrieb später Redis; Interface bleibt gleich.

## Open Decisions
Siehe OPEN-QUESTIONS Nr. 8.
