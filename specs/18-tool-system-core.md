---
id: 18-tool-system-core
title: Tool System Core
phase: 3
milestone: MVP
status: done
depends_on: [05-shared-contracts, 06-openai-integration]
provides: [tool_registry, tool_execution]
owner_modules: ["lib/tools/*"]
complexity: L
---

# Tool System Core

## Purpose
Einheitliche Definition, Registrierung, Validierung und Ausführung aller Werkzeuge — erweiterbar,
ohne den Orchestrator zu ändern.

## Scope / Out of Scope
In Scope: Tool-Interface, Registry, Guards, Normalisierung, Fehler, Telemetrie.
Out of Scope: Einzelne Tools (Specs 19–23).

## User Story
„Als Entwickler möchte ich ein neues Tool durch eine einzige Datei ergänzen können."

## Functional Requirements
- `FR-18-01` Ein Tool MUSS Name, Beschreibung, Zod-Parameterschema, Ergebnisschema, Timeout,
  Retry-Policy, Kostenklasse und `execute` definieren.
- `FR-18-02` Die Registry MUSS JSON-Schemas für das Modell erzeugen und nach Allowlist filtern.
- `FR-18-03` Jeder Aufruf MUSS Parameter validieren; ungültige Argumente → `VALIDATION_FAILED` als
  Tool-Ergebnis (kein Absturz), damit das Modell korrigieren kann.
- `FR-18-04` Jeder Aufruf MUSS Timeout und Abbruchsignal respektieren und `tool_calls` protokollieren.
- `FR-18-05` Ergebnisse MÜSSEN vor der Rückgabe an das Modell normalisiert und auf ein Token-Budget gekürzt werden.
- `FR-18-06` Tools DÜRFEN keine Events selbst emittieren; das übernimmt der Executor.
- `FR-18-07` Ein fehlgeschlagenes Tool DARF den Run nicht beenden.

## Expected Behavior
```ts
interface ToolDefinition<P, R> {
  name: ToolName; description: string; parameters: ZodType<P>; result: ZodType<R>;
  timeoutMs: number; maxRetries: number; costClass: 'free'|'cheap'|'expensive';
  resultTokenBudget: number;
  execute(args: P, ctx: ToolContext): Promise<R>;
  summarize(result: R): string;   // ≤ 120 Zeichen für den Trace
}
interface ToolContext { runId; conversationId; signal: AbortSignal; emitter; repos; config; logger; }
```
Executor: validieren → `tool.call.started` → `tool_calls.start` → ausführen mit Timeout/Retry →
Ergebnis validieren und kürzen → `tool_calls.finish` → `tool.call.completed`/`tool.call.failed`.
Retries nur bei `retryable` (Netzwerk, 5xx, Timeout), maximal `maxRetries`, Backoff 250 ms/1 s.

## User Flow
Nicht zutreffend.

## System Flow
`getToolsFor(allowed: ToolName[])` liefert Definitionen und JSON-Schemas für `generateWithTools`.

## Agent Behavior
Das Modell wählt Tools; die Allowlist des Task-Typs begrenzt die Auswahl hart.

## Contracts
`ToolName` aus Spec 05.

## API Requirements
Keine.

## Data Model
`tool_calls` (Spec 04).

## UI Requirements
Darstellung in Spec 30 anhand der Tool-Events.

## States
Tool-Call: `running` · `completed` · `failed` · `timeout`.

## Telemetry & Events
`tool.call.*`; Metriken: Aufrufe, Fehlerquote und p95-Dauer je Tool.

## Configuration
`TOOL_DEFAULT_TIMEOUT_MS` (15000), `TOOL_RESULT_TOKEN_BUDGET` (1500).

## Edge Cases
1. Modell ruft ein nicht erlaubtes Tool auf → Ergebnis „nicht verfügbar", Aufruf wird nicht ausgeführt.
2. Modell ruft dasselbe Tool mit identischen Argumenten erneut → Ergebnis aus dem Run-Cache.
3. Timeout → `TOOL_TIMEOUT`, das Modell erhält eine kurze Fehlermeldung als Tool-Ergebnis.
4. Sehr großes Ergebnis → gekürzt mit Hinweis `…gekürzt`.
5. Tool wirft synchron → in `AppError` gewandelt.
6. Abbruch während der Ausführung → `RUN_CANCELLED`, kein Retry.
7. Mehr als 20 Tool-Aufrufe je Run → `BUDGET_EXCEEDED`, Übergang zur Synthese.

## Error Handling
Fehler erreichen das Modell als strukturiertes Tool-Ergebnis `{ ok:false, code, message }`,
damit es reagieren kann, statt zu halluzinieren.

## Security Considerations
Tools erhalten nie Secrets in Argumenten. Argumente werden vor dem Loggen maskiert.
Tool-Ergebnisse sind untrusted (Spec 39).

## Performance Budget
Executor-Overhead ≤ 5 ms je Aufruf.

## Test Plan
`tests/unit/tool-executor.test.ts`: Validierung, Timeout, Retry, Abbruch, Kürzung, Cache, Allowlist.

## Acceptance Criteria
- `AC-18-01` Given ungültige Argumente, Then erhält das Modell `ok:false, VALIDATION_FAILED` und der Run läuft weiter. (FR-18-03)
- `AC-18-02` Given ein Tool über Timeout, Then endet der Aufruf mit `TOOL_TIMEOUT` in ≤ Timeout+100 ms. (FR-18-04)
- `AC-18-03` Given ein Ergebnis über Budget, Then ist der an das Modell übergebene Text gekürzt. (FR-18-05)
- `AC-18-04` Given ein nicht erlaubtes Tool, Then wird `execute` nicht aufgerufen. (FR-18-02)
- `AC-18-05` Given zwei identische Aufrufe, Then wird `execute` nur einmal ausgeführt. (Edge 2)

## Definition of Done
Executor-Tests grün; Registry deckt alle MVP-Tools ab.

## Dependencies
05, 06.

## Implementation Notes
Cache-Key = `tool + stabil serialisierte Argumente`, Gültigkeit nur innerhalb eines Runs.

## Open Decisions
Keine.
