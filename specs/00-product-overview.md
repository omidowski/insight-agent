---
id: 00-product-overview
title: Product Overview
phase: 1
milestone: MVP
status: done
depends_on: []
provides: [product_scope]
owner_modules: []
complexity: S
---

# Product Overview

## Purpose
Definiert, was gebaut wird und woran der Erfolg gemessen wird. Alle anderen Specs leiten ihre
Anforderungen hiervon ab. Das Produkt ist eine Web-App mit einem autonomen AI Research Agent:
Der Nutzer stellt eine Frage oder erteilt eine Rechercheaufgabe, der Agent entscheidet selbst über
Vorgehen und Werkzeuge, arbeitet sichtbar und liefert eine belegte Antwort.

## Scope / Out of Scope
**In Scope:** Chat, Anfrageklassifikation, Planung, Websuche, Seitenanalyse, iterative Recherche,
Quellenverwaltung, Citations, Widerspruchserkennung, sichtbarer Execution Trace, Persistenz.
**Out of Scope:** Modelltraining, allgemeiner Crawler, Browser-Automation mit fremden Logins,
Paywall-Umgehung, Multi-Persona-Agenten, native Apps, Team-Kollaboration.

## User Story
„Als recherchierende Person möchte ich einem Agenten eine Aufgabe in natürlicher Sprache geben,
seinen Arbeitsfortschritt sehen und eine Antwort erhalten, deren jede Aussage ich zur Quelle
zurückverfolgen kann."

## Functional Requirements
- `FR-00-01` Das Produkt MUSS die zehn MVP-Fähigkeiten aus `INDEX.md` erfüllen.
- `FR-00-02` Einfache Konversation MUSS ohne Tool-Aufruf und ohne Research-UI beantwortet werden.
- `FR-00-03` Rechercheaufgaben MÜSSEN einen sichtbaren, ereignisbasierten Fortschritt erzeugen.
- `FR-00-04` Jede faktische Aussage einer Research-Antwort MUSS eine Citation tragen oder als unbelegt markiert sein.
- `FR-00-05` Die Anwendung DARF keine simulierten Antworten erzeugen; ohne konfigurierten Anbieter
  verlangt sie eine Einrichtung (Spec 47, ADR-013).
- `FR-00-06` Der Nutzer MUSS das Modell aus den Angeboten seines Anbieters wählen können (Spec 48).

## Expected Behavior
Referenzszenarien (dienen als Grundlage der E2E-Tests):
| Eingabe | Pfad | Sichtbares Ergebnis |
|---|---|---|
| „Hallo" | `conversation` | Streamende Textantwort < 2 s, keine Activity-Karte |
| „Was ist ein Embedding?" | `knowledge_question` | Textantwort, keine Websuche |
| „Recherchiere Statistiken zu Jamal Musiala" | `deep_research` | Activity-Trace, ≥ 3 Quellen, Citations, Quellenpanel |
| „Vergleiche 3 Vereine nach Umsatz, erstelle eine Tabelle" | `multi_step_task` | Plan mit Teilschritten, Markdown-Tabelle, Citations |

## User Flow
1. Nutzer öffnet die App, sieht leeren Chat mit Beispiel-Prompts.
2. Nutzer sendet eine Nachricht.
3. Bei Research: Activity-Karte erscheint sofort, Statuszeile ändert sich live.
4. Antwort streamt in den Chat, Citation-Marker sind klickbar, Quellenpanel füllt sich.
5. Follow-up nutzt den bestehenden Recherchekontext.

## System Flow
Siehe `02-architecture-overview.md`.

## Agent Behavior
Der Agent entscheidet eigenständig über Pfad, Schritte und Tools innerhalb der in Spec 13 definierten
Allowlists und Budgets. Er fragt nur zurück, wenn die Klassifikation unsicher ist und ein falscher
Pfad hohe Kosten verursachen würde.

## Contracts
Keine eigenen; siehe `05-shared-contracts.md`.

## API Requirements
Keine eigenen.

## Data Model
Keine eigenen.

## UI Requirements
Einspaltiges Chat-Layout mit optionalem rechten Panel (Quellen) und Sidebar (Conversations).
Deutschsprachige Oberfläche.

## States
Nicht zutreffend — Begründung: Übersichtsdokument ohne eigenes Laufzeitverhalten.

## Telemetry & Events
Nicht zutreffend — Begründung: siehe Spec 40.

## Configuration
Nicht zutreffend — Begründung: siehe Spec 43.

## Edge Cases
1. Nutzer schickt leere Nachricht → Senden ist deaktiviert.
2. Nutzer schickt eine 20 000 Zeichen lange Nachricht → Kürzung mit Hinweis.
3. Nutzer stellt eine Frage ohne Rechercheanteil, verlangt aber „recherchiere" → expliziter Wunsch gewinnt.
4. Kein API-Key gesetzt → Einrichtungsbanner, Senden gesperrt, keine erfundene Antwort.
5. Nutzer lädt die Seite während eines laufenden Runs neu → Trace wird aus persistierten Events rekonstruiert.
6. Nutzer bricht ab → Teilergebnis bleibt sichtbar und ist als abgebrochen markiert.

## Error Handling
Siehe Spec 38.

## Security Considerations
Siehe Spec 39. Grundregel: Inhalte aus Web und Dateien sind Daten, nie Anweisungen.

## Performance Budget
Erste sichtbare Reaktion ≤ 1,5 s nach dem Absenden. Konversationsantwort vollständig ≤ 8 s.
Deep Research ≤ 180 s Wall-Clock.

## Test Plan
Die vier Referenzszenarien sind als Integrationstests mit Fixture-Providern abgebildet.

## Acceptance Criteria
- `AC-00-01` Given konfigurierten Anbieter, When „Hallo" gesendet wird, Then erscheint eine Antwort ohne Tool-Events. (FR-00-02)
- `AC-00-02` Given konfigurierten Anbieter, When eine Research-Anfrage gesendet wird, Then enthält der Event-Stream
  `plan.created`, `search.results`, `source.opened`, `run.completed` und die Antwort ≥ 1 Citation. (FR-00-03, FR-00-04)
- `AC-00-03` Given keinen Anbieter, When die App startet, Then zeigt sie den Einrichtungshinweis und
  beantwortet keine Frage. (FR-00-05)

## Definition of Done
Alle vier Referenzszenarien laufen grün; MVP-Liste aus `INDEX.md` vollständig abhakbar.

## Dependencies
Keine.

## Implementation Notes
Dieses Dokument wird nicht implementiert, sondern bei Scope-Änderungen zuerst aktualisiert.

## Open Decisions
Siehe `OPEN-QUESTIONS.md` Nr. 1 und 3.
