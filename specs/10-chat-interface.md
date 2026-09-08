---
id: 10-chat-interface
title: Chat Interface
phase: 2
milestone: MVP
status: done
depends_on: [11-conversation-management, 12-message-rendering, 09-streaming-protocol]
provides: [chat_ui]
owner_modules: ["app/page.tsx", "components/chat/*"]
complexity: L
---

# Chat Interface

## Purpose
Die zentrale Oberfläche: Nachrichten senden, Antworten streamen sehen, Runs abbrechen, wiederholen,
Modus wählen und Follow-ups stellen.

## Scope / Out of Scope
In Scope: Layout, Composer, Nachrichtenliste, Stop/Retry, Modusumschalter, Tastaturbedienung, Mobil.
Out of Scope: Activity-Trace (Spec 30), Quellenpanel (Spec 31), Rendering (Spec 12).

## User Story
„Als Nutzer möchte ich wie in einem modernen KI-Chat arbeiten und dabei den Research-Fortschritt sehen."

## Functional Requirements
- `FR-10-01` Der Composer MUSS mit Enter senden, Shift+Enter für Zeilenumbruch, und auf Inhalt wachsen (max. 12 Zeilen).
- `FR-10-02` Während eines laufenden Runs MUSS „Stopp" sichtbar sein und `POST /api/runs/:id/cancel` auslösen.
- `FR-10-03` Nach Abschluss oder Fehler MUSS „Erneut versuchen" verfügbar sein.
- `FR-10-04` Der Modusumschalter (`auto`/`chat`/`research`) MUSS an `POST /api/runs` übergeben werden.
- `FR-10-05` Die Ansicht MUSS automatisch nach unten scrollen, außer der Nutzer hat manuell hochgescrollt.
- `FR-10-06` Bei Research-Runs MUSS die Activity-Karte über der entstehenden Antwort erscheinen.
- `FR-10-07` Nach Reload MUSS ein laufender Run nahtlos weiter dargestellt werden.
- `FR-10-08` Die Oberfläche MUSS ab 360 px Breite bedienbar sein.

## Expected Behavior
Sofort nach dem Senden erscheinen die Nutzernachricht und ein Platzhalter mit Status „Analysiere Anfrage…".
`message.delta` füllt die Antwort. `run.completed` schließt sie ab und zeigt Quellen an.
Beispiel-Prompts im Leerzustand füllen den Composer.

## User Flow
1. Text eingeben → Enter.
2. Optimistische Anzeige der eigenen Nachricht.
3. `POST /api/runs` → `runId` → SSE öffnen.
4. Trace und Antwort laufen live.
5. Stopp/Retry jederzeit; Follow-up direkt anschließend.

## System Flow
Client hält je Run einen `EventSource`; ein Reducer bildet Events auf UI-State ab.

## Agent Behavior
Nicht zutreffend.

## Contracts
`ChatState { conversationId, messages, activeRun?, sources, error? }`.

## API Requirements
Spec 08.

## Data Model
Keine eigene.

## UI Requirements
Dreiteiliges Layout (Sidebar · Chat · Quellenpanel); Panels auf Mobil als Overlay.
Shortcuts: `Enter` senden, `Shift+Enter` Umbruch, `Esc` stoppt laufenden Run, `Strg/Cmd+K` neuer Chat.
Barrierefreiheit: Rollen, Fokusreihenfolge, `aria-live` für Status.

## States
`idle` · `submitting` · `streaming` · `completed` · `failed` · `cancelled`.

## Telemetry & Events
Konsumiert Events aus Spec 09; sendet selbst keine Telemetrie.

## Configuration
Keine.

## Edge Cases
1. Senden ohne Netz → Fehlerzustand mit Wiederholen; Eingabe bleibt erhalten.
2. SSE bricht ab → automatischer Reconnect ab letzter `seq`.
3. Run endet, während der Nutzer scrollt → kein erzwungener Sprung.
4. Sehr schnelle Deltas → Batch-Rendering pro Animationsframe.
5. Zwei Tabs auf derselben Conversation → beide zeigen denselben Verlauf (persistierte Events).
6. Nachricht > 20 000 Zeichen → Warnung, Senden blockiert.
7. Abbruch kurz vor Abschluss → Status `cancelled`, Teiltext bleibt.

## Error Handling
`run.failed` zeigt `userMessage` plus „Erneut versuchen"; technische Details nur in der Konsole.

## Performance Budget
Erste Reaktion ≤ 150 ms nach Enter; 60 fps beim Streamen; Bundle der Chatseite ≤ 250 KB gzip.

## Test Plan
`tests/integration/chat-flow.test.ts` über die API (Senden → Events → finale Message).
UI-Reducer-Tests: Eventfolge → erwarteter State inkl. Reconnect und Abbruch.

## Acceptance Criteria
- `AC-10-01` Given eine gesendete Nachricht, Then erscheint sie sofort und die Antwort streamt. (FR-10-01)
- `AC-10-02` Given ein laufender Run, When „Stopp", Then endet der Run als `cancelled` und der Teiltext bleibt. (FR-10-02)
- `AC-10-03` Given ein fehlgeschlagener Run, When „Erneut versuchen", Then startet ein neuer Run mit derselben Eingabe. (FR-10-03)
- `AC-10-04` Given Reload während eines Runs, Then wird der Trace vollständig rekonstruiert. (FR-10-07)
- `AC-10-05` Given Modus `chat`, When eine Research-Frage gestellt wird, Then erfolgt keine Websuche. (FR-10-04)

## Definition of Done
Alle Chat-Tests grün; Mobilansicht geprüft; Tastaturbedienung vollständig.

## Dependencies
09, 11, 12.

## Implementation Notes
Ein `useRunStream(runId)`-Hook kapselt EventSource, Reconnect und Reducer.

## Open Decisions
Keine.
