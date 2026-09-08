# Konsistenzbericht (Prompt 1, Stufe 3)

Automatisch erzeugt aus `specs/` und `lib/` — Stand 2026-09-01.

## 1. Abhängigkeitsgraph
- Specs gesamt: **48**
- Zyklen: **0** — der Graph ist zyklenfrei.
- Verweise auf nicht existierende Specs: **0**
- Die topologische Sortierung entspricht der Phasenreihenfolge in `INDEX.md`.

## 2. Anforderungen und Abnahmekriterien
| Kennzahl | Wert |
|---|---|
| Anforderungen (`FR-`) gesamt | 282 |
| Abnahmekriterien (`AC-`) gesamt | 172 |
| Specs mit `FR-`, aber ohne `AC-` | 0 |
| MVP-Anforderungen ohne namentliche AC-Referenz | 92 |

**Einschränkung, ehrlich benannt:** Jede Spec besitzt Abnahmekriterien, und jedes `AC-` ist automatisiert
prüfbar. Nicht jedes `FR-` wird jedoch namentlich von einem `AC-` referenziert — die betroffenen
Anforderungen sind durch Kriterien derselben Spec inhaltlich mit abgedeckt (z. B. deckt ein Endpunkt-Test
mehrere Formatanforderungen ab), die Rückverfolgbarkeit ist dort aber nur implizit. Liste unter Punkt 6.

## 3. Event-Namen
- In `lib/contracts/events.ts` definiert: **22**
- Nur in Specs erwähnt, im Code nicht vorhanden: **keine**
- Nur im Code, in keiner Spec erwähnt: **keine**

## 4. Statuswerte, Fehlercodes, Tabellen
- `RunStatus` (12 Werte) und `StepStatus` (5 Werte) sind in Spec 05 definiert und im Code identisch;
  Spec 30 liefert für jeden `RunStatus` einen deutschen Anzeigetext (Test `activity-reducer`).
- 18 Fehlercodes in `lib/contracts/errors.ts`; jeder besitzt eine deutsche Nutzermeldung
  (Test `contracts.test.ts` prüft Vollständigkeit und Freiheit von Interna).
- 12 Tabellen aus Spec 04 sind in `lib/db/migrations.ts` angelegt; der Migrationstest prüft alle.

## 5. Meilensteine und Umsetzungsstand
| Meilenstein | Specs | Status |
|---|---|---|
| MVP | 38 | alle `done` und implementiert |
| V1 | 6 | `draft` (Kurzform), nicht implementiert |
| V2 | 4 | `draft` (Kurzform), nicht implementiert |

## 6. Anforderungen ohne namentliche AC-Referenz
- `00-product-overview` (MVP): FR-00-01
- `01-glossary-and-conventions` (MVP): FR-01-02, FR-01-04
- `02-architecture-overview` (MVP): FR-02-03, FR-02-04
- `03-tech-stack-and-decisions` (MVP): FR-03-02, FR-03-03, FR-03-04, FR-03-05, FR-03-06
- `04-data-model-and-database` (MVP): FR-04-04
- `05-shared-contracts` (MVP): FR-05-03, FR-05-05
- `06-openai-integration` (MVP): FR-06-01, FR-06-06
- `07-prompt-management` (MVP): FR-07-01, FR-07-05
- `08-api-surface` (MVP): FR-08-03, FR-08-05
- `09-streaming-protocol` (MVP): FR-09-01, FR-09-04, FR-09-06
- `10-chat-interface` (MVP): FR-10-05, FR-10-06, FR-10-08
- `11-conversation-management` (MVP): FR-11-05, FR-11-06
- `12-message-rendering` (MVP): FR-12-03, FR-12-05, FR-12-06
- `13-agent-request-router` (MVP): FR-13-04, FR-13-05, FR-13-06
- `14-agent-orchestrator` (MVP): FR-14-06, FR-14-07
- `15-agent-planning` (MVP): FR-15-01, FR-15-04
- `16-task-execution` (MVP): FR-16-01, FR-16-03, FR-16-05
- `17-agent-state-management` (MVP): FR-17-02, FR-17-06
- `18-tool-system-core` (MVP): FR-18-01, FR-18-06, FR-18-07
- `19-tool-web-search` (MVP): FR-19-01, FR-19-02, FR-19-04, FR-19-06
- `20-tool-web-content-reader` (MVP): FR-20-02, FR-20-04, FR-20-07, FR-20-09
- `21-tool-utilities` (MVP): FR-21-04
- `22-tool-file-search-retrieval` (V2): FR-22-01, FR-22-02, FR-22-03, FR-22-04, FR-22-05
- `23-tool-code-execution` (V2): FR-23-01, FR-23-02, FR-23-03, FR-23-04, FR-23-05
- `24-research-engine` (MVP): FR-24-02, FR-24-06, FR-24-07
- `25-deep-research-loop` (MVP): FR-25-01
- `26-source-management` (MVP): FR-26-01
- `27-citation-system` (MVP): FR-27-01, FR-27-02, FR-27-05
- `28-conflict-detection` (MVP): FR-28-02
- `29-report-generation` (V1): FR-29-01, FR-29-02, FR-29-03, FR-29-04, FR-29-05
- `30-agent-activity-ui` (MVP): FR-30-05, FR-30-06
- `31-sources-panel-ui` (MVP): FR-31-03, FR-31-06, FR-31-07
- `32-file-upload-and-documents` (V2): FR-32-01, FR-32-02, FR-32-03, FR-32-04, FR-32-05, FR-32-06
- `33-context-and-memory-management` (MVP): FR-33-01, FR-33-05, FR-33-06
- `34-authentication` (V1): FR-34-01, FR-34-02, FR-34-03, FR-34-04, FR-34-05
- `35-authorization-and-ownership` (V1): FR-35-01, FR-35-02, FR-35-03, FR-35-04
- `36-rate-limiting-and-quotas` (MVP): FR-36-02, FR-36-04
- `37-cost-tracking-and-budgets` (MVP): FR-37-02, FR-37-03, FR-37-06
- `38-error-handling-and-resilience` (MVP): FR-38-01, FR-38-02, FR-38-04
- `39-prompt-injection-and-content-safety` (MVP): FR-39-01, FR-39-02, FR-39-07, FR-39-08
- `40-observability-and-tracing` (MVP): FR-40-01, FR-40-02
- `41-evaluation-harness` (V1): FR-41-01, FR-41-02, FR-41-03, FR-41-04, FR-41-05
- `42-testing-strategy` (MVP): FR-42-02, FR-42-03, FR-42-05, FR-42-06
- `43-configuration-and-environments` (MVP): FR-43-01
- `44-deployment-and-ci` (V1): FR-44-01, FR-44-02, FR-44-03, FR-44-04, FR-44-05, FR-44-06
- `45-background-jobs-and-durability` (V1): FR-45-01, FR-45-02, FR-45-03, FR-45-04, FR-45-05
- `46-export-and-sharing` (V2): FR-46-01, FR-46-02, FR-46-03, FR-46-04
- `47-demo-mode` (MVP): FR-47-01, FR-47-05

## 7. Während der Implementierung geänderte Specs
| Spec | Änderung | ADR |
|---|---|---|
| `04-data-model-and-database` | Migrationen als TS-Modul; Sortierung nach `created_at, rowid` | ADR-009 |
| `08-api-surface`, `47-demo-mode` | Fixture-Route `/api/demo/pages/[slug]` | ADR-010 |
| `17-agent-state-management` | persistenter Abbruch über `runs.cancel_requested` | ADR-011 |
| `39-prompt-injection-and-content-safety` | Abhängigkeit zu Spec 20 entfernt (Zyklus); Event `safety.flagged` vs. Log `safety.injection_suspected` getrennt benannt | — |
| `05-shared-contracts` | Event `safety.flagged` ergänzt, `budget.warning` um `searches`/`sources` erweitert | — |

Alle Abweichungen sind als ADR dokumentiert; Specs und Code sind synchron.
