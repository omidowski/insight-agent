---
id: 48-model-selection
title: Model Selection
phase: 5
milestone: MVP
status: done
depends_on: [06-openai-integration, 47-provider-setup]
provides: [model_catalog, model_override]
owner_modules: ["lib/llm/catalog.ts", "lib/llm/with-model.ts", "app/api/models/route.ts"]
complexity: M
---

# Model Selection

## Purpose
Der Nutzer soll das Sprachmodell selbst wählen können — aus den Modellen, die sein Anbieter tatsächlich
freigeschaltet hat, mit kuratierten Empfehlungen als Einstieg.

## Scope / Out of Scope
In Scope: Modellkatalog des aktiven Anbieters, Empfehlungen, Auswahl in der Oberfläche, Anwendung je Run.
Out of Scope: getrennte Wahl für schnelle und Hauptaufrufe (bleibt Konfiguration), Preisvergleich.

## User Story
„Als Nutzer möchte ich zwischen vielen Modellen wählen und meine Wahl sofort angewendet sehen."

## Functional Requirements
- `FR-48-01` `GET /api/models` MUSS die Modelle des aktiven Anbieters live abrufen und zurückgeben.
- `FR-48-02` Kuratierte Empfehlungen MÜSSEN zuerst erscheinen, alle übrigen alphabetisch danach.
- `FR-48-03` Nicht für Chat geeignete Modelle (Embeddings, Audio, Bild, Rerank) MÜSSEN gefiltert werden.
- `FR-48-04` Ein Fehler beim Katalogabruf DARF die Anwendung nicht beeinträchtigen; die Standardmodelle bleiben aktiv.
- `FR-48-05` Die Auswahl MUSS pro Run als `model` übergeben, in `runs.model_override` gespeichert und
  auf alle Modellaufrufe dieses Runs angewendet werden.
- `FR-48-06` Die zuletzt gewählte Auswahl MUSS im Browser erhalten bleiben.
- `FR-48-07` Der Katalog MUSS zwischengespeichert werden (5 Minuten), mit erzwungener Aktualisierung über `?refresh=1`.

## Expected Behavior
Auswahlfeld in der Kopfzeile mit zwei Gruppen: „Empfohlen" (mit Kurzhinweis wie „Guter Kompromiss")
und „Alle Modelle (n)". Ohne Auswahl gilt das konfigurierte Standardmodell.
Empfehlungen: OpenAI `gpt-5`, `gpt-5-mini`, `gpt-4.1`, `gpt-4.1-mini`;
NVIDIA `meta/llama-3.3-70b-instruct`, `nvidia/llama-3.3-nemotron-super-49b-v1`, `qwen/qwen2.5-72b-instruct`,
`deepseek-ai/deepseek-r1`, `mistralai/mistral-large-2-instruct`, `meta/llama-3.1-8b-instruct`.

## User Flow
Modell im Auswahlfeld wählen → Frage stellen → der Run nutzt dieses Modell → die Wahl bleibt beim
nächsten Besuch erhalten.

## System Flow
`POST /api/runs { model }` → `runs.model_override` → `withModel(provider, modelOverride)` umhüllt den
Provider und setzt `modelName` in jeder Anfrage.

## Agent Behavior
Die Modellwahl ändert nur das verwendete Modell, nicht die Agentenlogik oder die Budgets.

## Contracts
`ModelInfo { id, recommended, note? }`, `ModelCatalog { provider, models, currentFast, currentMain, fetchedAt }`.

## API Requirements
`GET /api/models` → `{ provider, models, currentFast, currentMain, fetchedAt }`; ohne Konfiguration
`{ provider: 'none', models: [] }`.

## Data Model
`runs.model_override TEXT NULL` (Migration `003_model_override`).

## UI Requirements
Auswahlfeld in der Kopfzeile, maximal 13 rem breit, mit Titel-Tooltip; auf Mobil zusammen mit dem
Modusumschalter sichtbar.

## States
`loading` · `ready` · `unavailable`.

## Telemetry & Events
`usage_events.model` hält je Aufruf das tatsächlich verwendete Modell fest.

## Configuration
Keine eigene; nutzt die Anbieterkonfiguration aus Spec 47.

## Edge Cases
1. Gespeichertes Modell ist nicht mehr verfügbar → Rückfall auf das Standardmodell.
2. Anbieter liefert keine Modellliste → nur Empfehlungen erscheinen.
3. Modell nicht freigeschaltet → Run endet mit klarer Meldung (Spec 06, FR-06-08).
4. Modellwechsel während eines laufenden Runs → wirkt erst für den nächsten Run.
5. `localStorage` nicht verfügbar → Auswahl gilt nur für die Sitzung.

## Error Handling
Katalogfehler werden geloggt und still übergangen; Modellfehler erscheinen als Run-Fehler.

## Security Considerations
Der Katalog enthält nur Modellnamen, keine Schlüssel. Die Modellwahl wird als Zeichenkette begrenzt
(120 Zeichen) und validiert.

## Performance Budget
Katalogabruf ≤ 10 s Timeout, danach aus dem Zwischenspeicher ≤ 1 ms.

## Test Plan
`tests/unit/model-catalog.test.ts` (Reihenfolge, Filter, Fehlertoleranz, Zwischenspeicher, `withModel`),
`tests/smoke/smoke.test.ts` (Katalog über HTTP, gewähltes Modell wird tatsächlich verwendet).

## Acceptance Criteria
- `AC-48-01` Given eine Anbieterliste, Then stehen Empfehlungen vorn und der Rest alphabetisch. (FR-48-02)
- `AC-48-02` Given Embedding- und Audiomodelle in der Liste, Then erscheinen sie nicht. (FR-48-03)
- `AC-48-03` Given einen Fehler beim Katalogabruf, Then bleibt die Anwendung nutzbar. (FR-48-04)
- `AC-48-04` Given ein gewähltes Modell, Then trägt jeder Aufruf dieses Runs diesen Modellnamen. (FR-48-05)
- `AC-48-05` Given einen Run mit `model`, Then geht die Anfrage beim Anbieter mit genau diesem Modell ein. (FR-48-05)

## Definition of Done
Katalog- und Smoke-Tests grün; Auswahlfeld in der Oberfläche sichtbar.

## Dependencies
06, 47.

## Implementation Notes
Empfehlungslisten stehen in `lib/llm/catalog.ts` und sind ohne Codeänderung an anderer Stelle erweiterbar.

## Open Decisions
Getrennte Wahl für `fast` und `main` bleibt bewusst der Konfiguration vorbehalten.
