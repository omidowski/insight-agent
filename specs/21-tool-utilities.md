---
id: 21-tool-utilities
title: Tool Utilities (Calculator, Date/Time)
phase: 4
milestone: MVP
status: done
depends_on: [18-tool-system-core]
provides: [calculator, datetime]
owner_modules: ["lib/tools/utilities.ts"]
complexity: S
---

# Tool Utilities

## Purpose
Deterministische Hilfstools, damit der Agent rechnet und Datumsbezüge auflöst, statt zu schätzen.

## Scope / Out of Scope
In Scope: `calculator`, `datetime`.
Out of Scope: Datenanalyse (Spec 23).

## User Story
„Als Nutzer möchte ich korrekte Zahlen und richtige Zeitbezüge in Rechercheergebnissen."

## Functional Requirements
- `FR-21-01` `calculator` MUSS arithmetische Ausdrücke (+ − × ÷, Klammern, Prozent, Potenz) sicher auswerten.
- `FR-21-02` `calculator` DARF keinen `eval`-artigen Mechanismus verwenden.
- `FR-21-03` `datetime` MUSS aktuelles Datum, Differenzen und Zeitzonenangaben (Default UTC) liefern.
- `FR-21-04` Beide Tools MÜSSEN ohne Netzwerkzugriff auskommen und < 5 ms brauchen.

## Expected Behavior
`calculator({ expression })` → `{ value, formatted }`, 15 signifikante Stellen.
`datetime({ operation: 'now'|'diff'|'add', ... })` → ISO-Werte plus lesbare Formulierung.

## User Flow / UI Requirements
Sichtbar als Tool-Aufruf im Trace.

## System Flow
Reine Funktionen im Tool-Executor.

## Agent Behavior
Der Agent MUSS `calculator` verwenden, wenn er Werte aus Quellen verrechnet (z. B. Summen, Differenzen, Prozente).

## Contracts
Zod-Schemas in `lib/tools/utilities.ts`.

## API Requirements / Data Model
Keine.

## States
Tool-Call-Status.

## Telemetry & Events
`tool.call.*`.

## Configuration
`DEFAULT_TIMEZONE` (UTC).

## Edge Cases
1. Division durch null → `ok:false, VALIDATION_FAILED`.
2. Ausdruck > 200 Zeichen → abgelehnt.
3. Nicht-numerische Token → abgelehnt.
4. Sehr große Zahlen → Exponentialdarstellung.
5. Ungültige Zeitzone → Fallback UTC mit Hinweis.

## Error Handling
Fehler als strukturiertes Tool-Ergebnis, nie als Ausnahme.

## Security Considerations
Eigener Tokenizer und Shunting-Yard-Parser; keine dynamische Codeausführung.

## Performance Budget
≤ 5 ms.

## Test Plan
`tests/unit/utilities.test.ts`: Rechenfälle, Präzedenz, Fehlereingaben, Datumsdifferenzen.

## Acceptance Criteria
- `AC-21-01` Given `(1200+300)*0.19`, Then `285`. (FR-21-01)
- `AC-21-02` Given `1/0`, Then Fehlerergebnis ohne Ausnahme. (Edge 1)
- `AC-21-03` Given `process.exit(1)` als Ausdruck, Then Ablehnung ohne Ausführung. (FR-21-02)
- `AC-21-04` Given `diff(2026-09-01, 2026-01-01)`, Then 243 Tage. (FR-21-03)

## Definition of Done
Tests grün; beide Tools registriert.

## Dependencies
18.

## Implementation Notes
Shunting-Yard mit expliziter Token-Allowlist.

## Open Decisions
Keine.
