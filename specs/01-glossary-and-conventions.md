---
id: 01-glossary-and-conventions
title: Glossary & Conventions
phase: 1
milestone: MVP
status: done
depends_on: []
provides: [vocabulary, conventions]
owner_modules: ["lib/contracts/*"]
complexity: S
---

# Glossary & Conventions

## Purpose
Legt Begriffe und technische Konventionen einmal verbindlich fest. Jede andere Spec und jeder
Bezeichner im Code verwendet exakt diese Wörter. Verhindert Synonymdrift („task"/„job"/„session").

## Scope / Out of Scope
In Scope: Vokabular, Namens-, Zeit-, ID-, Geld- und Sprachkonventionen.
Out of Scope: konkrete Typdefinitionen (Spec 05), Datenbankschema (Spec 04).

## User Story
„Als implementierender Agent möchte ich für jedes Konzept genau einen Namen kennen, damit ich keine
zwei Varianten desselben Feldes erzeuge."

## Functional Requirements
- `FR-01-01` Alle Specs und aller Code MÜSSEN die hier definierten Begriffe verwenden.
- `FR-01-02` Alle Zeitstempel MÜSSEN UTC ISO-8601 mit Millisekunden sein.
- `FR-01-03` Alle IDs MÜSSEN sortierbare ULIDs mit Typ-Präfix sein (`run_01J...`).
- `FR-01-04` Geldbeträge MÜSSEN als ganzzahlige Mikro-USD gespeichert werden.

## Expected Behavior
### Vokabular
| Begriff | Bedeutung |
|---|---|
| **Conversation** | Persistenter Chatverlauf eines Nutzers. |
| **Message** | Einzelner Beitrag (`user` \| `assistant` \| `system`). |
| **Run** | Eine Agenten-Ausführung als Reaktion auf genau eine Nutzernachricht. |
| **Task Type** | Klassifikationsergebnis des Routers (`conversation`, `deep_research`, …). |
| **Plan** | Geordnete Menge von **Steps** eines Runs. |
| **Step** | Teilaufgabe mit eigener Teilfrage, Status und Ergebnis. |
| **Tool Call** | Ein Aufruf eines registrierten Tools innerhalb eines Steps. |
| **Source** | Eine abgerufene, deduplizierte Informationsquelle (i. d. R. eine URL). |
| **Excerpt** | Wörtlicher Textausschnitt einer Source samt Offsets. |
| **Claim** | Faktische Aussage in der finalen Antwort. |
| **Citation** | Verknüpfung Claim → Source (+ Excerpt). |
| **Conflict** | Zwei Sources mit unvereinbaren Werten zum selben `claim_key`. |
| **Event** | Persistiertes Element des Execution Trace. |
| **Budget** | Obergrenze für Iterationen, Suchen, Quellen, Zeit, Token, Kosten. |

Verboten als Synonyme: „job", „session", „query run", „article", „snippet" (statt Excerpt), „link" (statt Source).

### Konventionen
- Datenbank: `snake_case`, Tabellen im Plural. TypeScript: `camelCase` für Felder, `PascalCase` für Typen.
- Event-Typen: `dot.case` (`tool.call.started`).
- Fehlercodes: `SCREAMING_SNAKE_CASE` (`TOOL_TIMEOUT`).
- Statuswerte: `snake_case` (`reading_sources`).
- Dateinamen: `kebab-case.ts`.
- UI-Texte deutsch; Bezeichner, Kommentare, Logs, Event-Namen englisch.
- Kein `any`; unbekannte Fremddaten sind `unknown` und werden per Zod geparst.

## User Flow
Nicht zutreffend — Begründung: kein Nutzerkontakt.

## System Flow
Nicht zutreffend — Begründung: reines Referenzdokument.

## Agent Behavior
Nicht zutreffend.

## Contracts
Alle Konventionen werden in `lib/contracts/` durch Typen und Zod-Enums erzwungen.

## API Requirements / Data Model / UI Requirements / States / Telemetry & Events / Configuration
Nicht zutreffend — Begründung: Querschnittsdokument.

## Edge Cases
1. Neuer Begriff nötig → zuerst hier ergänzen, dann verwenden.
2. Fremd-API liefert abweichende Namen → an der Systemgrenze in dieses Vokabular übersetzen.
3. Legacy-Feld in Fixture-Daten → Adapter, kein zweites Vokabular.

## Error Handling
Nicht zutreffend.

## Security Considerations
Logs dürfen keine Rohprompts, Secrets oder vollständige Seiteninhalte enthalten (siehe Spec 40).

## Performance Budget
Nicht zutreffend.

## Test Plan
Ein Lint-Test prüft, dass keine verbotenen Synonyme in `lib/` vorkommen (`tests/unit/conventions.test.ts`).

## Acceptance Criteria
- `AC-01-01` Given der Quellcode, When der Konventionstest läuft, Then findet er keine verbotenen Synonyme
  und keine `any`-Deklaration in `lib/`. (FR-01-01)
- `AC-01-02` Given eine erzeugte ID, When sie geprüft wird, Then hat sie Typ-Präfix und ist lexikografisch sortierbar. (FR-01-03)

## Definition of Done
Konventionstest grün; `lib/util/id.ts` implementiert.

## Dependencies
Keine.

## Implementation Notes
`lib/util/id.ts` implementiert ULID ohne externe Abhängigkeit (Zeitanteil 48 Bit + 80 Bit Zufall, Crockford-Base32).

## Open Decisions
Keine.
