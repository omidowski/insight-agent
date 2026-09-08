---
id: 04-data-model-and-database
title: Data Model & Database
phase: 1
milestone: MVP
status: done
depends_on: [01-glossary-and-conventions, 03-tech-stack-and-decisions, 05-shared-contracts]
provides: [schema, repositories]
owner_modules: ["lib/db/*"]
complexity: L
---

# Data Model & Database

## Purpose
Definiert das vollständige Persistenzschema und die Repository-Schnittstelle. Einzige Heimat aller
Tabellen- und Feldnamen; andere Specs verweisen hierher.

## Scope / Out of Scope
In Scope: Tabellen, Felder, Indizes, Migrationen, Repository-API, Aufbewahrung.
Out of Scope: Fachliche Regeln zur Quellenbewertung (Spec 26), Kostenlogik (Spec 37).

## User Story
„Als implementierender Agent möchte ich ein fertiges Schema, damit ich keine Feldnamen erfinde."

## Functional Requirements
- `FR-04-01` Alle Tabellen MÜSSEN per Migration in `lib/db/migrations.ts` angelegt werden (SQL als benannte
  Einträge `{ name, sql }`, siehe ADR-009).
- `FR-04-02` Migrationen MÜSSEN beim Start idempotent laufen und in `schema_migrations` protokolliert werden.
- `FR-04-03` Zugriff NUR über Repositories; kein SQL außerhalb `lib/db/`.
- `FR-04-04` JSON-Spalten MÜSSEN beim Lesen per Zod geparst werden.
- `FR-04-05` Löschen einer Conversation MUSS alle abhängigen Zeilen entfernen (Kaskade).

## Expected Behavior
### Tabellen
```sql
users(id TEXT PK, email TEXT UNIQUE, display_name TEXT, created_at TEXT)

conversations(id TEXT PK, user_id TEXT, title TEXT, created_at TEXT, updated_at TEXT,
              archived_at TEXT NULL)

messages(id TEXT PK, conversation_id TEXT, role TEXT, content TEXT, status TEXT,
         run_id TEXT NULL, created_at TEXT, updated_at TEXT)
  -- role: user|assistant|system ; status: complete|streaming|failed|cancelled

runs(id TEXT PK, conversation_id TEXT, user_id TEXT, request_message_id TEXT,
     response_message_id TEXT NULL, task_type TEXT, confidence REAL, status TEXT,
     plan_json TEXT NULL, current_step_id TEXT NULL, budgets_json TEXT,
     usage_json TEXT, cost_micro_usd INTEGER DEFAULT 0, error_json TEXT NULL,
     created_at TEXT, updated_at TEXT, finished_at TEXT NULL)

run_steps(id TEXT PK, run_id TEXT, seq INTEGER, title TEXT, question TEXT, status TEXT,
          depends_on_json TEXT, result_json TEXT NULL, created_at TEXT, updated_at TEXT)

run_events(id TEXT PK, run_id TEXT, seq INTEGER, type TEXT, payload_json TEXT, ts TEXT,
           UNIQUE(run_id, seq))

tool_calls(id TEXT PK, run_id TEXT, step_id TEXT NULL, tool_name TEXT, args_json TEXT,
           status TEXT, result_summary TEXT NULL, error_code TEXT NULL,
           duration_ms INTEGER NULL, created_at TEXT)

sources(id TEXT PK, run_id TEXT, conversation_id TEXT, index_num INTEGER, url TEXT,
        canonical_url TEXT, domain TEXT, title TEXT, author TEXT NULL,
        published_at TEXT NULL, fetched_at TEXT NULL, source_type TEXT, trust_score REAL,
        content_hash TEXT NULL, raw_text_len INTEGER DEFAULT 0, status TEXT, created_at TEXT)
  -- status: discovered|fetched|failed|skipped ; UNIQUE(run_id, canonical_url)

excerpts(id TEXT PK, source_id TEXT, run_id TEXT, text TEXT, start_offset INTEGER,
         end_offset INTEGER, claim_key TEXT NULL, extracted_value TEXT NULL, created_at TEXT)

citations(id TEXT PK, message_id TEXT, run_id TEXT, source_id TEXT, excerpt_id TEXT NULL,
          marker INTEGER, claim_text TEXT NULL, created_at TEXT)

conflicts(id TEXT PK, run_id TEXT, claim_key TEXT, description TEXT, entries_json TEXT, created_at TEXT)

usage_events(id TEXT PK, run_id TEXT, kind TEXT, model TEXT, input_tokens INTEGER,
             output_tokens INTEGER, cost_micro_usd INTEGER, created_at TEXT)

schema_migrations(name TEXT PK, applied_at TEXT)
```
### Indizes
`conversations(user_id, updated_at DESC)`, `messages(conversation_id, created_at)`,
`runs(conversation_id, created_at DESC)`, `run_events(run_id, seq)`, `sources(run_id, index_num)`,
`excerpts(source_id)`, `citations(message_id)`, `tool_calls(run_id, created_at)`, `usage_events(run_id)`.

### Repository-API (`lib/db/repositories/index.ts`)
`conversations`: `create`, `get`, `listByUser`, `rename`, `touch`, `remove`
`messages`: `create`, `appendContent`, `finalize`, `listByConversation`, `get`
`runs`: `create`, `get`, `update`, `listByConversation`, `setStatus`, `addUsage`
`steps`: `createMany`, `update`, `listByRun`
`events`: `append` (vergibt `seq` transaktional), `listByRun(runId, afterSeq, limit)`
`toolCalls`: `start`, `finish`
`sources`: `upsertByCanonicalUrl`, `update`, `listByRun`, `listByConversation`
`excerpts`: `create`, `listBySource`, `listByRun`
`citations`: `createMany`, `listByMessage`
`conflicts`: `create`, `listByRun`

## User Flow
Nicht zutreffend.

## System Flow
Beim Prozessstart öffnet `lib/db/client.ts` die Datei aus `DATABASE_PATH` (Default `./data/app.db`),
setzt `PRAGMA journal_mode=WAL`, `foreign_keys=ON`, und führt ausstehende Migrationen aus.

## Agent Behavior
Nicht zutreffend.

## Contracts
Zeilen-Typen und JSON-Spalten-Schemas in `lib/contracts/domain.ts` (Spec 05).

## API Requirements
Keine direkten; siehe Spec 08.

## Data Model
Siehe oben.

## UI Requirements
Nicht zutreffend.

## States
Nicht zutreffend — Begründung: Statusfelder werden in den jeweiligen Feature-Specs definiert.

## Telemetry & Events
Langsame Abfragen > 50 ms werden mit Statement-Namen geloggt.

## Configuration
`DATABASE_PATH` (Default `./data/app.db`), `DB_RESET_ON_START` (nur Tests).

## Edge Cases
1. Fehlendes Verzeichnis für die DB-Datei → wird angelegt.
2. Parallele Event-Inserts → `seq` wird in einer Transaktion aus `MAX(seq)+1` bestimmt; `UNIQUE(run_id, seq)` schützt.
3. Doppelte Quelle im selben Run → `upsertByCanonicalUrl` aktualisiert statt einzufügen.
4. Ungültiges JSON in einer JSON-Spalte → Lesefehler `DB_CORRUPT_JSON`, Feld wird als `null` behandelt.
5. Sehr großer Rohtext → auf 40 000 Zeichen gekürzt, `raw_text_len` behält die Originallänge.
6. Migration teilweise angewendet → jede Migration läuft in einer Transaktion.

## Error Handling
DB-Fehler werden als `DB_ERROR` mit Statementname geloggt; Aufrufer erhalten die Fehler-Envelope aus Spec 38.

## Security Considerations
Ausschließlich vorbereitete Statements (keine String-Konkatenation). Kein Speichern von API-Keys.
`user_id` ist in allen nutzerbezogenen Tabellen vorhanden, damit Spec 35 ohne Migration greifen kann.

## Performance Budget
Einzelabfragen ≤ 5 ms bei 10 000 Zeilen; Event-Append ≤ 2 ms.

## Test Plan
`tests/unit/db.test.ts`: Migration auf In-Memory-DB, CRUD je Repository, Kaskadenlöschung,
`seq`-Vergabe unter 100 parallelen Appends, Dedup von Quellen.

## Acceptance Criteria
- `AC-04-01` Given eine leere DB, When Migrationen laufen, Then existieren alle Tabellen und Indizes; ein zweiter Lauf ändert nichts. (FR-04-01, FR-04-02)
- `AC-04-02` Given 100 gleichzeitige `events.append`, When sie abgeschlossen sind, Then sind die `seq`-Werte lückenlos 1..100. (FR-04-03)
- `AC-04-03` Given eine Conversation mit Runs, Sources und Citations, When sie gelöscht wird, Then verbleiben keine abhängigen Zeilen. (FR-04-05)
- `AC-04-04` Given dieselbe URL zweimal in einem Run, When sie gespeichert wird, Then existiert genau eine `sources`-Zeile. (FR-04-03)

## Definition of Done
Alle DB-Tests grün, Migration eingecheckt, Repository-API vollständig typisiert.

## Dependencies
01, 03, 05.

## Implementation Notes
Migrationen liegen als TS-Modul vor, damit sie im Next.js-Serverbundle garantiert enthalten sind (ADR-009).
`node:sqlite` liefert `null`-Prototyp-Objekte — Zeilen vor der Rückgabe in einfache Objekte mappen.
Boolean als `INTEGER 0/1`. Alle Zeitwerte über `nowIso()` aus `lib/util/time.ts`.
Nachrichten werden nach `created_at, rowid` sortiert: zwei Inserts in derselben Millisekunde sind sonst
nicht stabil sortierbar (ULID-Zufallsanteil).

## Open Decisions
Siehe ADR-002 (Postgres-Adapter später).
