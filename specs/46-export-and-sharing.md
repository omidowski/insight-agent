---
id: 46-export-and-sharing
title: Export & Sharing
phase: 8
milestone: V2
status: draft
depends_on: [27-citation-system]
provides: [export]
complexity: M
---

# Export & Sharing

> Kurzform-Spec (V1/V2). Vor der Implementierung ins Vollformat aus `PROMPT-1` überführen.

## Purpose
Ergebnisse aus der App herausbekommen und teilen.

## Functional Requirements
- `FR-46-01` Export einer Antwort oder Conversation als Markdown inklusive Quellenverzeichnis.
- `FR-46-02` Export als PDF mit klickbaren Quellenlinks.
- `FR-46-03` Optionale Read-only-Links mit zufälligem Token, widerrufbar, ohne Nutzerdaten.
- `FR-46-04` Geteilte Ansichten DÜRFEN keine Rohprompts oder internen Logs enthalten.

## Acceptance Criteria
- `AC-46-01` Given eine Antwort mit 5 Quellen, When exportiert, Then enthält die Datei alle Marker und das Verzeichnis.
- `AC-46-02` Given ein widerrufener Link, Then liefert er `404`.

## Dependencies
27.
