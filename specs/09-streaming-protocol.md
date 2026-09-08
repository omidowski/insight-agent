---
id: 09-streaming-protocol
title: Streaming Protocol
phase: 2
milestone: MVP
status: done
depends_on: [05-shared-contracts, 04-data-model-and-database]
provides: [sse_transport, event_bus]
owner_modules: ["lib/agent/events.ts", "app/api/runs/[id]/events/route.ts"]
complexity: L
---

# Streaming Protocol

## Purpose
Überträgt den Execution Trace und die Antwort-Deltas live an den Client — nachvollziehbar,
wiederaufnehmbar und ohne interne Modellgedanken.

## Scope / Out of Scope
In Scope: Event-Persistenz, SSE-Endpunkt, Resume, Heartbeat, Client-Reader.
Out of Scope: Darstellung (Spec 30), Event-Semantik je Feature (jeweilige Spec).

## User Story
„Als Nutzer möchte ich live sehen, was der Agent tut, und nach einem Reload denselben Verlauf wiederfinden."

## Functional Requirements
- `FR-09-01` Jedes Event MUSS vor dem Versand persistiert werden (`run_events`).
- `FR-09-02` `seq` MUSS je Run lückenlos aufsteigend sein.
- `FR-09-03` Der SSE-Endpunkt MUSS `Last-Event-ID` und `?after=<seq>` unterstützen und ab dort ausliefern.
- `FR-09-04` Der Stream MUSS alle 15 s einen Kommentar-Heartbeat senden.
- `FR-09-05` Der Stream MUSS nach `run.completed`, `run.failed` oder `run.cancelled` schließen.
- `FR-09-06` Es DÜRFEN keine internen Modellgedanken übertragen werden; erlaubt sind nur die in Spec 05
  definierten Payloads plus eine Ein-Satz-`summary` (≤ 120 Zeichen).
- `FR-09-07` Ein abgebrochener Client DARF den Run nicht beenden.

## Expected Behavior
SSE-Rahmen:
```
id: 42
event: source.opened
data: {"id":"evt_…","runId":"run_…","conversationId":"cnv_…","seq":42,"ts":"…","type":"source.opened","payload":{…}}
```
Header: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`,
`Connection: keep-alive`, `X-Accel-Buffering: no`.
Der Leser pollt `events.listByRun(runId, afterSeq, 200)` alle 120 ms; bei Endstatus wird nach einem
letzten Nachlauf-Poll geschlossen. Maximale Streamdauer 10 min.

`emitter.emit(type, payload)` ist die einzige Schreibstelle; sie kürzt Payloads > 8 KB und validiert per Zod.

## User Flow
Client öffnet den Stream direkt nach `POST /api/runs` und rendert Events in Empfangsreihenfolge.

## System Flow
Orchestrator → `EventEmitter` → `events.append` (Transaktion, `seq = MAX+1`) → SSE-Poller → Client.

## Agent Behavior
Jeder Statuswechsel erzeugt genau ein `status.changed`; jeder Tool-Aufruf genau ein Start- und ein
Abschluss- oder Fehler-Event.

## Contracts
Event-Union aus Spec 05.

## API Requirements
`GET /api/runs/:id/events?after=<seq>` (SSE). `404` bei unbekanntem Run.

## Data Model
`run_events` (Spec 04).

## UI Requirements
Siehe Spec 30; der Client nutzt `EventSource` mit automatischem Reconnect.

## States
Stream: `connecting` → `open` → `closed`.

## Telemetry & Events
Zähler: Events je Run, Streamdauer, Reconnects.

## Configuration
`SSE_POLL_INTERVAL_MS` (120), `SSE_HEARTBEAT_MS` (15000), `SSE_MAX_DURATION_MS` (600000).

## Edge Cases
1. Run bereits beendet → alle Events werden sofort ausgeliefert, dann Schluss.
2. `after` größer als vorhandener `seq` → nur Heartbeats, bis neue Events kommen.
3. Zwei Streams auf denselben Run → beide erhalten identische Events.
4. Sehr großes Payload → gekürzt mit `truncated: true`.
5. Proxy puffert → Heartbeats und `X-Accel-Buffering: no` verhindern Hänger.
6. Prozessende → Client-Reconnect liefert alle persistierten Events erneut ab `after`.

## Error Handling
Lesefehler beenden den Stream mit `run.failed`-Ersatz-Event `code: INTERNAL`; der Run bleibt unverändert.

## Security Considerations
Nur der Eigentümer des Runs darf den Stream lesen (Spec 35, im MVP `local-user`).
Payloads werden vor dem Senden auf Secrets geprüft (Denylist für `sk-`, `Bearer `).

## Performance Budget
Verzögerung Event → Client ≤ 200 ms; Speicherbedarf je Stream ≤ 1 MB.

## Test Plan
`tests/integration/sse.test.ts`: vollständiger Empfang, Resume ab `after`, Heartbeat, Schließen bei Endstatus,
Client-Abbruch beendet den Run nicht.

## Acceptance Criteria
- `AC-09-01` Given ein laufender Run, When der Client ab `after=5` verbindet, Then beginnt der Stream bei `seq=6`. (FR-09-03)
- `AC-09-02` Given ein beendeter Run, When der Stream geöffnet wird, Then liefert er alle Events und schließt. (FR-09-05)
- `AC-09-03` Given 100 Events, Then sind die `seq`-Werte lückenlos. (FR-09-02)
- `AC-09-04` Given ein Client-Abbruch nach 3 Events, Then erreicht der Run trotzdem `completed`. (FR-09-07)
- `AC-09-05` Given ein Payload mit `sk-live-123`, Then enthält das gesendete Event den Wert nicht. (Security)

## Definition of Done
SSE-Tests grün; Client-Reader wiederverwendbar in `lib/client/event-stream.ts`.

## Dependencies
04, 05.

## Implementation Notes
`ReadableStream` mit `TextEncoder`; `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.

## Open Decisions
In-Memory-Bus als spätere Optimierung (ADR-003).
