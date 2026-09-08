---
id: 29-report-generation
title: Report Generation
phase: 7
milestone: V1
status: draft
depends_on: [24-research-engine, 27-citation-system]
provides: [reports]
complexity: L
---

# Report Generation

> Kurzform-Spec (V1/V2). Vor der Implementierung ins Vollformat aus `PROMPT-1` überführen.

## Purpose
Erzeugt aus Rechercheergebnissen längere, gegliederte Berichte statt einer Chatantwort.

## Functional Requirements
- `FR-29-01` Der Bericht MUSS aus Gliederung, Abschnitten, Tabellen, Fazit und Quellenverzeichnis bestehen.
- `FR-29-02` Die Gliederung MUSS aus dem Plan abgeleitet und vor dem Schreiben sichtbar gemacht werden.
- `FR-29-03` Abschnitte MÜSSEN einzeln erzeugt und gestreamt werden, um Kontextgrenzen einzuhalten.
- `FR-29-04` Citations MÜSSEN abschnittsweise erhalten bleiben (Spec 27).
- `FR-29-05` Ein Bericht MUSS als Markdown exportierbar sein (Spec 46).

## Acceptance Criteria
- `AC-29-01` Given eine Berichtsanfrage, Then enthält das Ergebnis Gliederung, ≥ 3 Abschnitte und ein Quellenverzeichnis.
- `AC-29-02` Given ein Abschnittsfehler, Then bleiben die übrigen Abschnitte erhalten.

## Dependencies
24, 27.
