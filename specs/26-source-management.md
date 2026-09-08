---
id: 26-source-management
title: Source Management
phase: 4
milestone: MVP
status: done
depends_on: [04-data-model-and-database, 20-tool-web-content-reader]
provides: [sources, excerpts, trust_ranking]
owner_modules: ["lib/agent/research/sources.ts"]
complexity: L
---

# Source Management

## Purpose
Verwaltet alle Quellen eines Runs: Anlegen, Deduplizieren, Bewerten, Nummerieren und Excerpts speichern.
Grundlage für Citations und Widerspruchserkennung.

## Scope / Out of Scope
In Scope: Quellenmodell, Dedup, Trust-Score, Auswahl, Excerpt-Persistenz, Nummerierung.
Out of Scope: Zuordnung zu Aussagen (Spec 27), Konflikte (Spec 28).

## User Story
„Als Nutzer möchte ich sehen, welche Quellen genutzt wurden und wie vertrauenswürdig sie sind."

## Functional Requirements
- `FR-26-01` Jede Quelle MUSS `title, url, canonicalUrl, domain, publishedAt?, fetchedAt, sourceType, trustScore, excerpts[]` besitzen.
- `FR-26-02` Dedup MUSS über `canonicalUrl` je Run und zusätzlich über `contentHash` erfolgen.
- `FR-26-03` Jede genutzte Quelle MUSS eine stabile, ab 1 aufsteigende `index_num` erhalten (Reihenfolge des Öffnens).
- `FR-26-04` Der Trust-Score MUSS aus nachvollziehbaren Faktoren berechnet werden.
- `FR-26-05` Die Quellenauswahl MUSS Primär- und vertrauenswürdige Quellen bevorzugen und die Domain-Vielfalt sichern
  (maximal 3 Quellen je Domain je Run).
- `FR-26-06` Excerpts MÜSSEN wörtlich aus dem Quelltext stammen und mit Offsets belegt sein; nicht auffindbare
  Excerpts MÜSSEN verworfen werden.
- `FR-26-07` Quellen MÜSSEN je Conversation abrufbar sein, damit Follow-ups sie wiederverwenden können.

## Expected Behavior
Trust-Score (0–1), gewichtete Summe:
| Faktor | Gewicht | Regel |
|---|---|---|
| Quellentyp | 0,35 | primary 1,0 · secondary 0,7 · aggregator 0,5 · social 0,25 · unknown 0,4 |
| Aktualität | 0,25 | ≤ 90 Tage 1,0 · ≤ 1 Jahr 0,8 · ≤ 3 Jahre 0,5 · älter/unbekannt 0,3 |
| Domain-Reputation | 0,25 | Allowlist bekannter Referenzdomains 0,9 · TLD `.gov/.edu/.org` 0,8 · sonst 0,6 · Blogplattformen 0,4 |
| Übereinstimmung | 0,15 | Anteil der Werte, die von ≥ 1 weiterer Quelle bestätigt werden |
Typbestimmung: offizielle Domain des Subjekts oder Statistikamt → `primary`; Nachrichtenmedien → `secondary`;
Portale/Wikis → `aggregator`; soziale Netzwerke → `social`.

## User Flow
Quellenpanel zeigt Nummer, Titel, Domain, Datum, Trust-Balken und Excerpts (Spec 31).

## System Flow
Suche → `sources.upsert(discovered)` → Auswahl nach Score und Vielfalt → Abruf (Spec 20) →
`sources.update(fetched)` → Excerpt-Extraktion (Spec 24) → `excerpts.create` → `source.extracted`.

## Agent Behavior
Das Modell schlägt vor, welche Treffer geöffnet werden; die Auswahlregeln aus FR-26-05 sind bindend
und werden im Code durchgesetzt.

## Contracts
`SourceRecord`, `ExcerptRecord` in `lib/contracts/domain.ts`.

## API Requirements
Quellen sind Teil von `GET /api/runs/:id` und `GET /api/conversations/:id`.

## Data Model
`sources`, `excerpts` (Spec 04).

## UI Requirements
Siehe Spec 31.

## States
`discovered` · `fetched` · `failed` · `skipped`.

## Telemetry & Events
`source.opened`, `source.extracted`; Metriken: Quellen je Run, Anteil fehlgeschlagener Abrufe.

## Configuration
`MAX_SOURCES_PER_DOMAIN` (3), `MIN_TRUST_FOR_USE` (0.3).

## Edge Cases
1. Zwei URLs mit identischem Inhalt (Spiegelseite) → gleiche `contentHash` → eine Quelle.
2. Quelle ohne Datum → Aktualitätsfaktor 0,3, Hinweis „Datum unbekannt".
3. Quelle mit Trust < `MIN_TRUST_FOR_USE` → nur nutzbar, wenn keine bessere existiert; Kennzeichnung in der Antwort.
4. Excerpt nicht im Text auffindbar → verworfen und geloggt (Halluzinationsschutz).
5. Mehr als 3 Treffer derselben Domain → überzählige `skipped`.
6. Follow-up in derselben Conversation → vorhandene Quellen werden mit ihrer Nummer wiederverwendet.
7. Quelle liegt hinter einem Proxy oder einer Spiegelseite → gleiche Behandlung, Dedup über `contentHash`.

## Error Handling
Abruffehler machen die Quelle `failed`; der Snippet der Suche bleibt als schwacher Beleg nutzbar, ist aber
als „nur Suchergebnis" gekennzeichnet.

## Security Considerations
Titel und Metadaten aus Quellen sind untrusted und werden beim Rendern escaped (Spec 12).

## Performance Budget
Bewertung und Auswahl von 30 Treffern ≤ 20 ms.

## Test Plan
`tests/unit/sources.test.ts`: Dedup (URL und Hash), Score-Berechnung je Faktor, Domain-Limit,
Nummernstabilität, Verwerfen nicht auffindbarer Excerpts.

## Acceptance Criteria
- `AC-26-01` Given zwei Treffer mit gleicher `canonicalUrl`, Then existiert eine Quelle. (FR-26-02)
- `AC-26-02` Given eine offizielle Domain mit Datum von gestern, Then `trustScore ≥ 0.85`. (FR-26-04)
- `AC-26-03` Given 5 Treffer derselben Domain, Then werden höchstens 3 geöffnet. (FR-26-05)
- `AC-26-04` Given ein Excerpt, das nicht im Quelltext vorkommt, Then wird es nicht gespeichert. (FR-26-06)
- `AC-26-05` Given ein Follow-up, Then behalten bereits genutzte Quellen ihre Nummer. (FR-26-03, FR-26-07)

## Definition of Done
Tests grün; Quellenpanel zeigt korrekte Nummern und Scores.

## Dependencies
04, 20.

## Implementation Notes
`contentHash` = SHA-256 über den normalisierten Text (Whitespace kollabiert, Kleinschreibung).
Domain-Reputationsliste als Datei `lib/agent/research/domain-reputation.ts`, erweiterbar.

## Open Decisions
Siehe OPEN-QUESTIONS Nr. 7.
