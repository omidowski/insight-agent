---
id: 05-shared-contracts
title: Shared Contracts
phase: 1
milestone: MVP
status: done
depends_on: [01-glossary-and-conventions]
provides: [domain_types, event_union, error_codes, zod_schemas]
owner_modules: ["lib/contracts/*"]
complexity: M
---

# Shared Contracts

## Purpose
Einzige Quelle für geteilte Typen, Zod-Schemas, Event-Definitionen, Statuswerte und Fehlercodes.
Jede andere Spec und jedes Modul importiert von hier statt zu duplizieren.

## Scope / Out of Scope
In Scope: Typen und Schemas, die von mindestens zwei Modulen genutzt werden.
Out of Scope: modul-lokale Hilfstypen.

## User Story
„Als implementierender Agent möchte ich Event-Namen, Statuswerte und Fehlercodes an genau einer Stelle finden."

## Functional Requirements
- `FR-05-01` Alle Enums (TaskType, RunStatus, StepStatus, SourceType, ToolName, ErrorCode, EventType)
  MÜSSEN hier als Zod-Enum definiert und als TS-Typ abgeleitet werden.
- `FR-05-02` Das Event-Objekt MUSS eine diskriminierte Union über `type` sein.
- `FR-05-03` Jedes API-Request-/Response-Format MUSS ein Zod-Schema besitzen.
- `FR-05-04` Zod-Schemas für Tool-Parameter MÜSSEN in JSON-Schema für das Modell konvertierbar sein.
- `FR-05-05` Kein Modul außerhalb `lib/contracts` DARF diese Werte neu definieren.

## Expected Behavior
### Enums
```ts
TaskType = conversation | knowledge_question | web_lookup | deep_research | comparison
         | document_analysis | data_analysis | report_generation | multi_step_task | unsafe_or_refused
RunStatus = idle | routing | planning | searching | reading_sources | extracting | comparing
          | synthesizing | completed | failed | cancelled | paused
StepStatus = pending | running | completed | failed | skipped
SourceType = primary | secondary | aggregator | social | unknown
MessageRole = user | assistant | system
ToolName = web_search | open_url | extract_content | search_in_page | calculator | datetime
```
### Event-Envelope
```ts
interface AgentEventEnvelope<T extends EventType = EventType> {
  id: string; runId: string; conversationId: string; seq: number;
  ts: string; type: T; payload: EventPayloadMap[T];
}
```
### Event-Typen und Payloads (verbindlich)
| Type | Payload |
|---|---|
| `run.started` | `{ taskTypeHint?: TaskType, userRequestPreview: string }` |
| `router.classified` | `{ taskType, confidence, summary }` |
| `plan.created` | `{ steps: {id,title,question}[] }` |
| `plan.updated` | `{ reason, steps }` |
| `step.started` | `{ stepId, title }` |
| `step.completed` | `{ stepId, summary }` |
| `tool.call.started` | `{ toolCallId, tool: ToolName, argsSummary }` |
| `tool.call.completed` | `{ toolCallId, tool, durationMs, resultSummary }` |
| `tool.call.failed` | `{ toolCallId, tool, code: ErrorCode, message }` |
| `search.results` | `{ query, count, topDomains: string[] }` |
| `source.opened` | `{ sourceId, index, url, domain, title }` |
| `source.extracted` | `{ sourceId, index, excerptCount, summary }` |
| `sources.compared` | `{ comparedCount, agreementCount, conflictCount }` |
| `conflict.detected` | `{ claimKey, description, sourceIndexes: number[] }` |
| `status.changed` | `{ from: RunStatus, to: RunStatus }` |
| `message.delta` | `{ messageId, delta }` |
| `citation.added` | `{ marker, sourceId, index }` |
| `budget.warning` | `{ kind: 'time'\|'cost'\|'tokens'\|'iterations'\|'searches'\|'sources', used, limit }` |
| `safety.flagged` | `{ sourceId, pattern, severity }` |
| `run.failed` | `{ code: ErrorCode, userMessage }` |
| `run.cancelled` | `{ atStatus: RunStatus }` |
| `run.completed` | `{ messageId, sourceCount, citationCount, durationMs, costMicroUsd }` |

### Fehler-Envelope und Codes
```ts
interface AppError { code: ErrorCode; message: string; userMessage: string;
                     retryable: boolean; details?: Record<string, unknown>; }
```
`ErrorCode`: `VALIDATION_FAILED` `NOT_FOUND` `UNAUTHORIZED` `RATE_LIMITED` `LLM_UNAVAILABLE`
`LLM_TIMEOUT` `LLM_BAD_OUTPUT` `TOOL_TIMEOUT` `TOOL_FAILED` `SEARCH_FAILED` `FETCH_BLOCKED`
`FETCH_FAILED` `CONTENT_TOO_LARGE` `BUDGET_EXCEEDED` `RUN_CANCELLED` `DB_ERROR` `DB_CORRUPT_JSON`
`INTERNAL`.

### Budgets
```ts
interface RunBudgets { maxIterations: number; maxSearches: number; maxSources: number;
  maxWallClockMs: number; maxInputTokens: number; maxCostMicroUsd: number; }
```

## User Flow / UI Requirements
Nicht zutreffend.

## System Flow
Contracts werden zur Buildzeit typgeprüft; zur Laufzeit validieren API-Handler eingehende Daten mit den Schemas.

## Agent Behavior
Structured Outputs des Modells werden gegen die hier definierten Schemas geparst; Fehlschlag → `LLM_BAD_OUTPUT` und ein Wiederholungsversuch mit Reparaturhinweis.

## Contracts
Diese Spec ist der Vertrag.

## API Requirements
Nicht zutreffend.

## Data Model
Zeilen-Typen spiegeln Spec 04 in `camelCase`; Mapper liegen in `lib/db/repositories`.

## States
Siehe `RunStatus`/`StepStatus` oben.

## Telemetry & Events
Alle Event-Namen kommen ausschließlich aus dieser Datei.

## Configuration
Nicht zutreffend.

## Edge Cases
1. Unbekannter Event-Typ aus der DB → wird beim Lesen verworfen und geloggt, bricht den Stream nicht ab.
2. Modell liefert unbekannten `taskType` → Fallback `knowledge_question`, `confidence = 0`.
3. Schemaänderung → neue Felder optional einführen, alte Events bleiben lesbar.
4. Payload > 8 KB → wird vor dem Speichern gekürzt (`…`), Trace bleibt funktionsfähig.

## Error Handling
`toAppError(unknown): AppError` normalisiert beliebige Fehler; unbekannte werden `INTERNAL`.

## Security Considerations
Payloads dürfen keine Secrets, keine vollständigen Prompts und keine kompletten Seiteninhalte enthalten.

## Performance Budget
Schema-Parsing eines Events ≤ 1 ms.

## Test Plan
`tests/unit/contracts.test.ts`: jede `EventType` hat ein Payload-Schema; Round-Trip Parse/Serialize;
`toAppError` deckt alle Codes ab; Zod→JSON-Schema-Konvertierung für alle Tools erfolgreich.

## Acceptance Criteria
- `AC-05-01` Given die Event-Union, When der Contract-Test läuft, Then existiert für jede `EventType` ein Payload-Schema und umgekehrt. (FR-05-02)
- `AC-05-02` Given ein beliebiger geworfener Fehler, When `toAppError` aufgerufen wird, Then ist das Ergebnis eine vollständige `AppError`-Envelope. (FR-05-01)
- `AC-05-03` Given alle Tool-Schemas, When sie konvertiert werden, Then entsteht gültiges JSON-Schema ohne `any`. (FR-05-04)

## Definition of Done
Contract-Tests grün; keine Enum-Duplikate im Repo (Konventionstest).

## Dependencies
01.

## Implementation Notes
Dateien: `lib/contracts/domain.ts`, `events.ts`, `errors.ts`, `schemas.ts`, `index.ts`.
JSON-Schema-Erzeugung über eine kleine eigene Funktion `zodToJsonSchema` in `lib/contracts/json-schema.ts`
(nur die tatsächlich genutzten Zod-Typen: object, string, number, boolean, array, enum, optional).

## Open Decisions
Keine.
