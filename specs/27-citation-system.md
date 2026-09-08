---
id: 27-citation-system
title: Citation System
phase: 4
milestone: MVP
status: done
depends_on: [26-source-management]
provides: [citations]
owner_modules: ["lib/agent/research/citations.ts"]
complexity: L
---

# Citation System

## Purpose
Verknüpft jede faktische Aussage der Antwort mit einer tatsächlich abgerufenen Quelle und verhindert
erfundene Belege.

## Scope / Out of Scope
In Scope: Marker-Vergabe, Zuordnung, Verifikation, Persistenz, Nachbearbeitung der Antwort.
Out of Scope: Darstellung (Spec 12/31), Quellenbewertung (Spec 26).

## User Story
„Als Nutzer möchte ich hinter jeder Zahl sehen, woher sie stammt."

## Functional Requirements
- `FR-27-01` Marker MÜSSEN `[n]` sein, wobei `n` der `index_num` der Quelle entspricht.
- `FR-27-02` Nach der Synthese MUSS jede Aussage mit Marker gegen die vorhandenen Quellen geprüft werden.
- `FR-27-03` Marker ohne existierende Quelle MÜSSEN aus dem Text entfernt und geloggt werden.
- `FR-27-04` Für jeden verbleibenden Marker MUSS eine `citations`-Zeile mit `sourceId`, optional `excerptId`
  und dem zugehörigen Satz gespeichert werden.
- `FR-27-05` Faktische Aussagen ohne Marker MÜSSEN im Abschnitt „Nicht belegt" gesammelt oder entfernt werden.
- `FR-27-06` Die Antwort MUSS ein Quellenverzeichnis mit Nummer, Titel, Domain und Datum enthalten.
- `FR-27-07` Jedes gespeicherte Citation MUSS ein `citation.added`-Event erzeugen.

## Expected Behavior
Nachbearbeitung:
1. Marker im Text finden (außerhalb von Codeblöcken).
2. Unbekannte Marker entfernen, Text glätten (doppelte Leerzeichen, Satzzeichen).
3. Je Satz mit Marker: `claim_text` = Satz (max. 300 Zeichen).
4. Passendes Excerpt der Quelle über Wortüberdeckung wählen (bester Treffer, mindestens 0,3).
5. Citations speichern, Events emittieren.
6. Quellenverzeichnis anhängen, wenn es fehlt.

## User Flow
Klick auf `[2]` markiert Quelle 2 im Panel; Hover zeigt Titel und Excerpt.

## System Flow
`applyCitations(answer, sources, runCtx)` → `{ text, citations[] }` — läuft immer nach der Synthese
und vor dem Finalisieren der Message.

## Agent Behavior
Der Synthese-Prompt fordert Marker; die Durchsetzung erfolgt im Code, nicht im Vertrauen auf das Modell.

## Contracts
`Citation { id, messageId, sourceId, excerptId?, marker, claimText }`.

## API Requirements
Citations sind Teil der Message in `GET /api/conversations/:id`.

## Data Model
`citations` (Spec 04).

## UI Requirements
Marker als Buttons (Spec 12), Quellenverzeichnis am Ende der Antwort.

## States
Nicht zutreffend.

## Telemetry & Events
`citation.added`; Metrik: Anteil belegter Aussagen je Antwort.

## Configuration
`MIN_EXCERPT_MATCH` (0.3).

## Edge Cases
1. `[12]` bei nur 5 Quellen → Marker entfernt, Log.
2. Mehrere Marker in einem Satz `[1][3]` → zwei Citations für denselben Satz.
3. Marker im Codeblock → unverändert, keine Citation.
4. Antwort ohne jeden Marker bei vorhandenen Quellen → Warnung im Log, Abschnitt „Nicht belegt" wird ergänzt.
5. Quelle wurde nur als Suchsnippet genutzt → Citation erlaubt, aber im Verzeichnis als „nur Suchergebnis" markiert.
6. Sehr viele Marker (> 100) → alle werden verarbeitet, Antwortzeit bleibt im Budget.

## Error Handling
Fehler in der Nachbearbeitung dürfen die Antwort nicht verlieren: im Zweifel wird der Rohtext gespeichert
und der Fehler geloggt.

## Security Considerations
Quellentitel im Verzeichnis werden escaped; URLs werden validiert, bevor sie als Link erscheinen.

## Performance Budget
Nachbearbeitung einer 10 000-Zeichen-Antwort ≤ 50 ms.

## Test Plan
`tests/unit/citations.test.ts`: Markererkennung, Entfernen unbekannter Marker, Mehrfachmarker,
Codeblock-Ausnahme, Excerpt-Zuordnung, Quellenverzeichnis.

## Acceptance Criteria
- `AC-27-01` Given eine Antwort mit `[1]` und `[9]` bei 3 Quellen, Then bleibt `[1]` und `[9]` verschwindet. (FR-27-03)
- `AC-27-02` Given `[1][2]` in einem Satz, Then entstehen zwei Citations mit demselben `claimText`. (FR-27-04)
- `AC-27-03` Given eine Antwort ohne Verzeichnis, Then wird eines mit allen genutzten Quellen ergänzt. (FR-27-06)
- `AC-27-04` Given jede gespeicherte Citation, Then existiert ein `citation.added`-Event. (FR-27-07)

## Definition of Done
Citation-Tests grün; Klick auf Marker funktioniert in der UI.

## Dependencies
26.

## Implementation Notes
Satzsegmentierung über eine einfache Regel (`. ! ?` gefolgt von Leerzeichen/Ende), Abkürzungen wie „z. B." ausgenommen.

## Open Decisions
Keine.
