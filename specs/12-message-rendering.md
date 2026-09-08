---
id: 12-message-rendering
title: Message Rendering
phase: 2
milestone: MVP
status: done
depends_on: [05-shared-contracts]
provides: [markdown_renderer, citation_markers]
owner_modules: ["components/chat/Markdown.tsx"]
complexity: M
---

# Message Rendering

## Purpose
Stellt Antworten sicher und lesbar dar: Markdown, Codeblöcke, Tabellen und klickbare Citation-Marker.

## Scope / Out of Scope
In Scope: Rendering, Sanitizing, Marker-Verlinkung, Streaming-Darstellung.
Out of Scope: Citation-Erzeugung (Spec 27).

## User Story
„Als Nutzer möchte ich formatierte Antworten lesen und per Klick auf `[2]` zur Quelle springen."

## Functional Requirements
- `FR-12-01` Markdown MUSS mit `remark-gfm` gerendert und mit `rehype-sanitize` bereinigt werden; rohes HTML ist verboten.
- `FR-12-02` `[n]`-Marker MÜSSEN in klickbare Elemente umgewandelt werden, die die Quelle `n` hervorheben.
- `FR-12-03` Codeblöcke MÜSSEN eine Kopieren-Schaltfläche und Sprachlabel haben.
- `FR-12-04` Tabellen MÜSSEN horizontal scrollen, ohne das Layout zu sprengen.
- `FR-12-05` Während des Streamings MUSS unvollständiges Markdown ohne Sprünge dargestellt werden.
- `FR-12-06` Externe Links MÜSSEN `target="_blank" rel="noopener noreferrer"` tragen und die Domain anzeigen.

## Expected Behavior
Marker-Erkennung über `/\[(\d{1,2})\]/g` außerhalb von Codeblöcken. Unbekannter Index bleibt als
Klartext stehen (kein Link). Beim Streamen werden unfertige Codefences virtuell geschlossen.

## User Flow
Antwort erscheint zeichenweise; nach Abschluss sind Marker klickbar; Klick scrollt und markiert die Quelle.

## System Flow
Reines Client-Rendering; die Marker-Zuordnung kommt aus den Citations der Message.

## Agent Behavior
Nicht zutreffend.

## Contracts
`MessageView { id, role, content, status, citations: {marker, sourceId, index}[] }`.

## API Requirements / Data Model
Keine eigenen.

## UI Requirements
Lesbare Typografie (max. 72 Zeichen Zeilenlänge), Dunkel-/Hellmodus über CSS-Variablen,
Fokusringe für Tastaturbedienung, `aria-live="polite"` auf dem streamenden Antwortbereich.

## States
`streaming` · `complete` · `failed` · `cancelled`.

## Telemetry & Events
Keine.

## Configuration
Keine.

## Edge Cases
1. `[3]` innerhalb eines Codeblocks → kein Link.
2. Marker ohne zugehörige Quelle → Klartext.
3. Sehr breite Tabelle → eigener Scrollcontainer.
4. Antwort mit `<script>` → entfernt.
5. Abgebrochener Stream → Teiltext bleibt sichtbar mit Hinweis „abgebrochen".
6. Sehr lange Antwort (> 20 000 Zeichen) → Rendering bleibt flüssig (Memoisierung je Message).

## Error Handling
Renderfehler werden abgefangen; die Rohnachricht wird als Klartext dargestellt.

## Security Considerations
Sanitizing ist Pflicht — Modellantworten und Quelltitel gelten als untrusted (Spec 39).

## Performance Budget
Rendering einer 5 000-Zeichen-Antwort ≤ 30 ms; kein Re-Render abgeschlossener Nachrichten beim Streamen.

## Test Plan
`tests/unit/markdown.test.ts`: XSS-Eingaben werden entschärft; Marker-Ersetzung; Codeblock-Ausnahme;
unvollständige Fences.

## Acceptance Criteria
- `AC-12-01` Given `<img src=x onerror=alert(1)>`, When gerendert, Then enthält das DOM kein `onerror`. (FR-12-01)
- `AC-12-02` Given „Wert liegt bei 12 [2]." mit vorhandener Quelle 2, Then ist `[2]` ein Button. (FR-12-02)
- `AC-12-03` Given ein Codeblock mit `[1]`, Then bleibt der Text unverändert. (Edge 1)
- `AC-12-04` Given eine 8-spaltige Tabelle auf 375 px Breite, Then scrollt nur die Tabelle. (FR-12-04)

## Definition of Done
Renderer-Tests grün; visuell in Hell und Dunkel geprüft.

## Dependencies
05.

## Implementation Notes
Marker-Ersetzung als eigener Rehype-Plugin-Schritt auf Textknoten, nicht per String-Replace im Markdown.

## Open Decisions
Keine.
