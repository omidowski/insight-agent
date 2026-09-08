---
id: 41-evaluation-harness
title: Evaluation Harness
phase: 7
milestone: V1
status: draft
depends_on: [24-research-engine, 27-citation-system]
provides: [evals]
complexity: L
---

# Evaluation Harness

> Kurzform-Spec (V1/V2). Vor der Implementierung ins Vollformat aus `PROMPT-1` überführen.

## Purpose
Misst die Qualität der Recherche reproduzierbar, damit Prompt- und Modelländerungen bewertbar werden.

## Functional Requirements
- `FR-41-01` Ein Golden-Set von ≥ 20 Aufgaben mit erwarteten Fakten und Quellenarten MUSS existieren.
- `FR-41-02` Gemessen werden MÜSSEN: Citation-Abdeckung, Anteil verifizierter Excerpts, Quellenvielfalt,
  Konflikterkennung, Laufzeit, Kosten.
- `FR-41-03` Faktentreue MUSS gegen hinterlegte Erwartungswerte geprüft werden (exakt oder Toleranz).
- `FR-41-04` Ergebnisse MÜSSEN als Bericht mit Vergleich zum vorherigen Lauf ausgegeben werden.
- `FR-41-05` Der Lauf MUSS im Demo-Modus deterministisch sein.

## Acceptance Criteria
- `AC-41-01` Given `npm run eval`, Then entsteht ein Bericht mit allen Kennzahlen.
- `AC-41-02` Given eine Verschlechterung der Citation-Abdeckung > 10 %, Then schlägt der Lauf fehl.

## Dependencies
24, 27.
