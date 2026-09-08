---
id: 28-conflict-detection
title: Conflict Detection
phase: 4
milestone: MVP
status: done
depends_on: [26-source-management]
provides: [conflicts]
owner_modules: ["lib/agent/research/conflicts.ts"]
complexity: M
---

# Conflict Detection

## Purpose
Erkennt widersprüchliche Angaben zwischen Quellen und stellt sie transparent dar, statt sie zu glätten.

## Scope / Out of Scope
In Scope: Vergleich je `claimKey`, Normalisierung von Werten, Toleranzen, Darstellungstext.
Out of Scope: Bewertung, welche Quelle recht hat (nur Hinweis über Trust-Score).

## User Story
„Als Nutzer möchte ich erkennen, wenn Quellen sich widersprechen, statt eine erfundene Einigkeit zu lesen."

## Functional Requirements
- `FR-28-01` Werte MÜSSEN vor dem Vergleich normalisiert werden (Zahlformat, Einheiten, Tausendertrennzeichen, Währungen, Prozent).
- `FR-28-02` Numerische Abweichungen ≤ 1 % ODER innerhalb einer expliziten Rundung gelten als übereinstimmend.
- `FR-28-03` Abweichungen darüber MÜSSEN als `Conflict` gespeichert und als `conflict.detected` gemeldet werden.
- `FR-28-04` Die Antwort MUSS beide Werte mit Quellenmarkern nennen; Mitteln oder stilles Auswählen ist verboten.
- `FR-28-05` Unterschiedliche Bezugszeiträume MÜSSEN als solche erkannt und nicht als Widerspruch gewertet werden,
  sofern der Zeitraum aus dem `claimKey` oder Excerpt hervorgeht.

## Expected Behavior
`Conflict { claimKey, description, entries: { sourceId, index, value, normalized, trustScore }[] }`.
Formulierung in der Antwort:
„Der Umsatz wird mit 765 Mio. € [2] bzw. 744 Mio. € [4] angegeben; die Abweichung geht auf
unterschiedliche Geschäftsjahre zurück." (Begründung nur, wenn belegbar.)
Reihenfolge der Nennung nach `trustScore` absteigend.

## User Flow
Konflikte erscheinen im Trace („1 Abweichung gefunden") und als Hinweis im Antworttext sowie im Quellenpanel.

## System Flow
Nach der Aggregation je `claimKey` → `detectConflicts(items)` → Persistenz → Events → Übergabe an die Synthese.

## Agent Behavior
Der Synthese-Prompt erhält die Konfliktliste als Datenblock mit der Auflage, sie transparent zu nennen.

## Contracts
`Conflict` wie oben.

## API Requirements
Teil von `GET /api/runs/:id`.

## Data Model
`conflicts` (Spec 04).

## UI Requirements
Warnsymbol am betroffenen Abschnitt und im Quellenpanel.

## States
Nicht zutreffend.

## Telemetry & Events
`conflict.detected`, `sources.compared`; Metrik: Konflikte je Run.

## Configuration
`CONFLICT_NUMERIC_TOLERANCE` (0.01).

## Edge Cases
1. „1,2 Mio." vs. „1200000" → gleich nach Normalisierung.
2. „765 Mio. €" vs. „765 Mio. USD" → Konflikt (unterschiedliche Währung), keine Umrechnung.
3. „Saison 2024/25" vs. „Saison 2025/26" → kein Konflikt, unterschiedlicher Zeitraum.
4. Textwerte („Mittelfeldspieler" vs. „offensives Mittelfeld") → nur Konflikt bei klarer Unvereinbarkeit; sonst Hinweis.
5. Drei Quellen, zwei einig, eine abweichend → Konflikt mit Mehrheitsangabe, ohne die Minderheit zu verschweigen.
6. Wert nur in einer Quelle → kein Konflikt, aber „nur eine Quelle" als Schwäche vermerkt.

## Error Handling
Nicht normalisierbare Werte werden als Textvergleich behandelt; Fehler führen nie zum Abbruch.

## Security Considerations
Keine besonderen.

## Performance Budget
Vergleich von 200 Einträgen ≤ 10 ms.

## Test Plan
`tests/unit/conflicts.test.ts`: Normalisierung (Zahl, Einheit, Währung, Prozent), Toleranz,
Zeitraumunterscheidung, Mehrheitsfall.

## Acceptance Criteria
- `AC-28-01` Given „1,2 Mio." und „1200000", Then kein Konflikt. (FR-28-01)
- `AC-28-02` Given 765 und 744 zur selben Kennzahl, Then ein Konflikt mit beiden Werten. (FR-28-03)
- `AC-28-03` Given ein Konflikt, Then nennt die Antwort beide Werte mit Markern und keinen Mittelwert. (FR-28-04)
- `AC-28-04` Given verschiedene Saisonangaben, Then kein Konflikt. (FR-28-05)

## Definition of Done
Konflikttests grün; Demo-Run zeigt mindestens einen erkannten Konflikt.

## Dependencies
26.

## Implementation Notes
Normalisierung in `lib/util/values.ts`: erkennt `1.234,56` und `1,234.56`, Suffixe
(`Tsd`, `Mio`, `Mrd`, `k`, `m`, `bn`), Währungssymbole, Prozent, Einheiten.

## Open Decisions
Währungsumrechnung bewusst ausgeschlossen (falsche Genauigkeit).
