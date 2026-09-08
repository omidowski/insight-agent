---
id: 44-deployment-and-ci
title: Deployment & CI
phase: 8
milestone: V1
status: draft
depends_on: [42-testing-strategy]
provides: [deployment]
complexity: M
---

# Deployment & CI

> Kurzform-Spec (V1/V2). Vor der Implementierung ins Vollformat aus `PROMPT-1` überführen.

## Purpose
Reproduzierbarer Build, automatisierte Prüfung und dokumentierter Betrieb.

## Functional Requirements
- `FR-44-01` CI MUSS `typecheck`, `lint`, `test` und `build` bei jedem Push ausführen.
- `FR-44-02` Migrationen MÜSSEN beim Start automatisch und idempotent laufen.
- `FR-44-03` Ein Dockerfile MUSS die App inklusive persistentem Datenverzeichnis betreiben können.
- `FR-44-04` `/api/health` MUSS als Readiness-Probe dienen.
- `FR-44-05` Secrets DÜRFEN nur über Umgebungsvariablen gesetzt werden.
- `FR-44-06` Für Vercel-Betrieb MUSS die Persistenz auf Postgres umgestellt werden (ADR-002).

## Acceptance Criteria
- `AC-44-01` Given ein frischer Klon, When `npm ci && npm run verify`, Then läuft alles grün.
- `AC-44-02` Given der Container, When gestartet, Then antwortet `/api/health` mit `ok`.

## Dependencies
42.
