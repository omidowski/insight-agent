---
id: 06-openai-integration
title: OpenAI Integration
phase: 1
milestone: MVP
status: done
depends_on: [05-shared-contracts, 43-configuration-and-environments, 47-provider-setup]
provides: [llm_provider]
owner_modules: ["lib/llm/*"]
complexity: L
---

# OpenAI Integration

## Purpose
Kapselt jeden Modellzugriff hinter einem Interface: Textausgabe, Streaming, Structured Outputs,
Tool-Calling, Retries, Timeouts und Kostenerfassung.

## Scope / Out of Scope
In Scope: Provider-Interface, OpenAI-Implementierung (Responses API), Fehlerklassifikation, Usage.
Out of Scope: Prompttexte (Spec 07), Toolausführung (Spec 18).

## User Story
„Als Orchestrator möchte ich Modellergebnisse typsicher anfordern, ohne SDK-Details zu kennen."

## Functional Requirements
- `FR-06-01` `LLMProvider` MUSS `generateText`, `streamText`, `generateObject<T>` und `generateWithTools` bereitstellen.
- `FR-06-02` `generateObject` MUSS gegen ein Zod-Schema validieren und bei Fehlschlag genau einmal mit
  Reparaturhinweis wiederholen, danach `LLM_BAD_OUTPUT`.
- `FR-06-03` Jeder Aufruf MUSS Timeout (Default 60 s) und bis zu 2 Retries mit exponentiellem Backoff
  (250 ms, 1 s, ±20 % Jitter) für `429`/`5xx`/Netzwerkfehler haben.
- `FR-06-04` Jeder Aufruf MUSS Usage (Input-/Output-Token, geschätzte Kosten) an `usage_events` melden.
- `FR-06-05` Der Provider MUSS über `AbortSignal` abbrechbar sein.
- `FR-06-06` Modellnamen kommen ausschließlich aus der Konfiguration.
- `FR-06-07` Neben OpenAI MÜSSEN nutzbar sein: ein OpenAI-kompatibler HTTP-Anbieter (Chat Completions,
  ADR-012) und die Hermes-Agent-CLI (ADR-015). Die Auswahl erfolgt über `LLM_PROVIDER`.
- `FR-06-09` Beim Anbieter `hermes` DARF die Anwendung keine Zugangsdaten halten; fehlende Zugangsdaten
  MÜSSEN als `LLM_NOT_CONFIGURED` mit Verweis auf `~/.hermes/.env` gemeldet werden.
- `FR-06-08` Anbieterfehler MÜSSEN als behebbare Meldung erscheinen: abgelehnter Schlüssel, fehlendes
  Modell, erschöpftes Kontingent und Ratelimit werden unterschieden.

## Expected Behavior
```ts
interface LLMProvider {
  readonly name: string;
  generateText(req: TextRequest): Promise<TextResult>;
  streamText(req: TextRequest): AsyncIterable<string>;
  generateObject<T>(req: ObjectRequest<T>): Promise<T>;
  generateWithTools(req: ToolRequest): Promise<ToolTurnResult>;
}
type TextRequest = { system: string; input: LLMInput[]; model?: 'fast'|'main';
                     maxOutputTokens?: number; temperature?: number; signal?: AbortSignal;
                     runId?: string; purpose: string };
```
`LLMInput` trennt Instruktionen von Daten: `{ role:'user'|'assistant', text }` oder
`{ role:'data', label: string, content: string }` — Datenblöcke werden mit Delimitern und dem Hinweis
eingebettet, dass sie Daten und keine Anweisungen sind (Spec 39).

Fehlerabbildung: Timeout → `LLM_TIMEOUT`; 401/403 → `LLM_UNAVAILABLE` (nicht retryable);
429/5xx → nach Retries `LLM_UNAVAILABLE` (retryable); Schemafehler → `LLM_BAD_OUTPUT`;
Abbruch → `RUN_CANCELLED`.

## User Flow
Nicht zutreffend.

## System Flow
`getLLMProvider()` liefert je nach `config.demoMode` `OpenAIProvider` oder `FixtureLLMProvider`
(gleiches Interface, austauschbar in Tests).

## Agent Behavior
Structured Outputs werden für Router, Planung, Extraktion und Konfliktprüfung genutzt;
freier Text nur für die Endantwort und Konversation.

## Contracts
`lib/llm/provider.ts` exportiert die Interfaces; Schemas kommen aus Spec 05.

## API Requirements
Keine.

## Data Model
Schreibt `usage_events` (Spec 04).

## UI Requirements
Nicht zutreffend.

## States
Nicht zutreffend.

## Telemetry & Events
Log je Aufruf: `purpose`, Modell, Dauer, Token, Kosten, Versuche. Keine Prompt-Inhalte auf `info`.

## Configuration
`OPENAI_API_KEY`, `OPENAI_MODEL_FAST`, `OPENAI_MODEL_MAIN`, `LLM_TIMEOUT_MS` (Default 60000).

## Edge Cases
1. Antwort ohne Inhalt → einmal wiederholen, dann `LLM_BAD_OUTPUT`.
2. Modell liefert zusätzliche Felder → Zod `strip`, kein Fehler.
3. Stream bricht mitten ab → bereits gestreamter Text bleibt erhalten, Message-Status `failed`.
4. Kontext zu lang → Eingabe wird nach Spec 33 gekürzt, danach ein Wiederholungsversuch.
5. Kein Usage-Feld in der Antwort → Schätzung über Zeichen/4, als `estimated` markiert.
6. Abbruch während des Streams → `RUN_CANCELLED`, keine weiteren Deltas.

## Error Handling
Alle Fehler werden als `AppError` geworfen; der Orchestrator entscheidet über Fallbacks.

## Security Considerations
API-Key nur serverseitig. Tool-Ergebnisse und Webinhalte gehen ausschließlich als `role:'data'` in den Kontext.

## Performance Budget
Klassifikation ≤ 3 s, Extraktion je Quelle ≤ 6 s, Synthese ≤ 45 s.

## Test Plan
`tests/unit/llm-provider.test.ts` gegen ein Fake-Transport: Retry-Verhalten, Timeout, Schema-Reparatur,
Abbruch, Usage-Erfassung. Kein Netzwerkzugriff in Tests.

## Acceptance Criteria
- `AC-06-01` Given zwei aufeinanderfolgende `429`, When `generateText` läuft, Then folgt ein dritter Versuch und Erfolg. (FR-06-03)
- `AC-06-02` Given eine schemaverletzende Modellantwort, When `generateObject` läuft, Then folgt genau ein Reparaturversuch und danach `LLM_BAD_OUTPUT`. (FR-06-02)
- `AC-06-03` Given ein abgebrochenes `AbortSignal`, When gestreamt wird, Then endet der Iterator mit `RUN_CANCELLED`. (FR-06-05)
- `AC-06-04` Given ein erfolgreicher Aufruf, Then existiert ein `usage_events`-Eintrag mit Kosten > 0. (FR-06-04)
- `AC-06-05` Given `LLM_PROVIDER=nvidia`, When ein Text erzeugt wird, Then geht die Anfrage an
  `/chat/completions` der NVIDIA-Basis-URL und das Ergebnis erfüllt dieselbe Schnittstelle. (FR-06-07)
- `AC-06-06` Given HTTP 401 bzw. `insufficient_quota`, Then nennt `userMessage` die konkrete Ursache
  und der Fehler ist nicht `retryable`. (FR-06-08)
- `AC-06-07` Given `LLM_PROVIDER=hermes` und fehlende Zugangsdaten in Hermes, Then meldet die App
  `LLM_NOT_CONFIGURED` mit dem Hinweis auf `~/.hermes/.env`. (FR-06-09)

## Definition of Done
Provider-Tests grün; Fixture- und OpenAI-Provider erfüllen dieselbe Testsuite (Contract-Test).

## Dependencies
05, 43, 47.

## Implementation Notes
Responses API mit `input`-Array; Structured Outputs über `text.format` = `json_schema` mit
`strict: true` aus dem generierten JSON-Schema. Preise je 1M Token in `lib/llm/pricing.ts`, überschreibbar per Env.

## Open Decisions
Siehe OPEN-QUESTIONS Nr. 5.
