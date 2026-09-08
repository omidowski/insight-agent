---
id: 11-conversation-management
title: Conversation Management
phase: 2
milestone: MVP
status: done
depends_on: [08-api-surface]
provides: [conversations]
owner_modules: ["lib/conversations/*", "components/sidebar/*"]
complexity: M
---

# Conversation Management

## Purpose
Persistente Chatverläufe: anlegen, auflisten, öffnen, benennen, löschen — damit Recherchen wiederauffindbar sind.

## Scope / Out of Scope
In Scope: Lebenszyklus, Auto-Titel, History-Laden, Sidebar-Daten.
Out of Scope: Nachrichtendarstellung (Spec 12), Runs (Spec 17).

## User Story
„Als Nutzer möchte ich frühere Recherchen wiederfinden und fortsetzen."

## Functional Requirements
- `FR-11-01` Eine Conversation MUSS beim ersten Senden automatisch entstehen, wenn keine aktiv ist.
- `FR-11-02` Der Titel MUSS nach der ersten Assistant-Antwort automatisch generiert werden (≤ 60 Zeichen).
- `FR-11-03` Die Liste MUSS nach `updated_at` absteigend sortiert sein.
- `FR-11-04` Löschen MUSS alle abhängigen Daten entfernen und ist zu bestätigen.
- `FR-11-05` Beim Öffnen MÜSSEN Nachrichten, Quellen und der letzte Run-Status geladen werden.
- `FR-11-06` Läuft beim Öffnen noch ein Run, MUSS der Client dessen Event-Stream ab `seq=0` wieder aufnehmen.

## Expected Behavior
Auto-Titel: erster Versuch per Modell (`titlePrompt`), Fallback = erste 48 Zeichen der Nutzernachricht.
`updated_at` wird bei jeder neuen Nachricht gesetzt. Umbenennen ist inline möglich.

## User Flow
1. Neue Conversation über „Neuer Chat" oder implizit beim ersten Senden.
2. Sidebar zeigt Titel und Zeitpunkt; Klick lädt den Verlauf.
3. Kontextmenü: Umbenennen, Löschen (mit Bestätigung).

## System Flow
`GET /api/conversations/:id` liefert Conversation, Nachrichten (aufsteigend), Quellen (nach `index_num`)
und den letzten Run. Läuft der Run noch, öffnet der Client den SSE-Stream.

## Agent Behavior
Der Titel-Prompt erhält nur die erste Nutzernachricht und die ersten 300 Zeichen der Antwort.

## Contracts
`ConversationSummary { id, title, updatedAt, messageCount, lastRunStatus }`.

## API Requirements
Siehe Spec 08.

## Data Model
`conversations`, `messages` (Spec 04).

## UI Requirements
Sidebar (auf Mobil ausklappbar), aktive Markierung, Leerzustand mit Beispiel-Prompts,
Skeleton beim Laden, Bestätigungsdialog beim Löschen.

## States
`loading` · `ready` · `empty` · `error`.

## Telemetry & Events
Logs für Anlegen, Umbenennen, Löschen mit `conversation_id`.

## Configuration
`MAX_CONVERSATIONS_LISTED` (Default 100).

## Edge Cases
1. Löschen der aktiven Conversation → Wechsel auf leeren Zustand.
2. Titelgenerierung schlägt fehl → Fallback-Titel, kein sichtbarer Fehler.
3. Sehr lange History (> 200 Nachrichten) → Laden der letzten 100 mit „Ältere laden".
4. Gleichzeitiges Löschen in zwei Tabs → zweiter Aufruf erhält `404`, UI räumt auf.
5. Titel mit Zeilenumbrüchen → normalisiert auf eine Zeile.

## Error Handling
Fehler beim Laden → Fehlerzustand mit Wiederholen-Schaltfläche; Löschfehler → Toast, Liste bleibt konsistent.

## Security Considerations
Jede Operation prüft `user_id` (im MVP `local-user`), damit Spec 35 nur den Nutzerkontext ersetzen muss.

## Performance Budget
Liste ≤ 100 ms; Öffnen einer Conversation ≤ 300 ms bei 100 Nachrichten.

## Test Plan
`tests/integration/conversations.test.ts`: Lebenszyklus, Sortierung, Kaskadenlöschung, Auto-Titel-Fallback.

## Acceptance Criteria
- `AC-11-01` Given kein aktiver Chat, When gesendet wird, Then entsteht genau eine Conversation. (FR-11-01)
- `AC-11-02` Given eine erste Antwort, Then ist der Titel ≠ „Neuer Chat" und ≤ 60 Zeichen. (FR-11-02)
- `AC-11-03` Given zwei Conversations mit unterschiedlichem `updated_at`, Then steht die neuere oben. (FR-11-03)
- `AC-11-04` Given Löschung, Then sind Messages, Runs, Events, Sources und Citations entfernt. (FR-11-04)

## Definition of Done
Tests grün; Sidebar funktionsfähig inkl. Mobilansicht.

## Dependencies
08.

## Implementation Notes
Client-State in einem einfachen React-Context; kein globales State-Framework.

## Open Decisions
Keine.
