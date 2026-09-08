---
id: 23-tool-code-execution
title: Code Execution Tool
phase: 7
milestone: V2
status: draft
depends_on: [18-tool-system-core]
provides: [code_execution]
complexity: XL
---

# Code Execution Tool

> Kurzform-Spec (V1/V2). Vor der Implementierung ins Vollformat aus `PROMPT-1` überführen.

## Purpose
Erlaubt Berechnungen und Datenauswertungen, die über den Calculator hinausgehen.

## Scope / Out of Scope
In Scope: Sandbox, Ressourcengrenzen, Ergebnisrückgabe, Diagrammdaten.
Out of Scope: Beliebiger Netzwerkzugriff aus dem Code.

## Functional Requirements
- `FR-23-01` Ausführung MUSS in einer isolierten Sandbox ohne Netzwerk und ohne Dateisystemzugriff erfolgen.
- `FR-23-02` Laufzeit (10 s), Speicher (256 MB) und Ausgabegröße (100 KB) MÜSSEN begrenzt sein.
- `FR-23-03` Nur eine Allowlist von Bibliotheken DARF verfügbar sein.
- `FR-23-04` Fehler MÜSSEN als strukturiertes Tool-Ergebnis zurückkommen.
- `FR-23-05` Der ausgeführte Code MUSS im Trace sichtbar sein.

## Acceptance Criteria
- `AC-23-01` Given Code mit Netzwerkzugriff, Then schlägt die Ausführung mit klarer Meldung fehl.
- `AC-23-02` Given eine Endlosschleife, Then bricht die Ausführung nach 10 s ab.

## Security Considerations
Höchstes Risiko im gesamten System — ohne echte Sandbox (separater Prozess/Container) nicht freigeben.

## Dependencies
18.
