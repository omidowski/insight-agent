---
id: 03-tech-stack-and-decisions
title: Tech Stack & Decisions
phase: 1
milestone: MVP
status: done
depends_on: []
provides: [stack]
owner_modules: ["package.json", "tsconfig.json"]
complexity: S
---

# Tech Stack & Decisions

## Purpose
Fixiert die Technologiewahl, damit der implementierende Agent keine Stack-Entscheidungen trifft.

## Scope / Out of Scope
In Scope: Laufzeit, Framework, Persistenz, Validierung, Tests, Styling.
Out of Scope: Deployment-Details (Spec 44).

## User Story
„Als implementierender Agent möchte ich genau eine erlaubte Bibliothek je Aufgabe kennen."

## Functional Requirements
- `FR-03-01` Node ≥ 22, TypeScript `strict`, Next.js App Router, React 19.
- `FR-03-02` Persistenz über `node:sqlite` hinter `lib/db/repositories` (ADR-002).
- `FR-03-03` Validierung ausschließlich mit Zod (ADR-008).
- `FR-03-04` LLM-Zugriff ausschließlich über das offizielle `openai`-SDK, gekapselt in `lib/llm/openai.ts`.
- `FR-03-05` Tests mit Vitest; Markdown-Rendering mit `react-markdown` + `remark-gfm` + `rehype-sanitize`.
- `FR-03-06` HTML-Extraktion mit `cheerio`.
- `FR-03-07` Keine weiteren Laufzeitabhängigkeiten ohne ADR.

## Expected Behavior
Erlaubte Laufzeitabhängigkeiten: `next`, `react`, `react-dom`, `zod`, `openai`, `cheerio`,
`react-markdown`, `remark-gfm`, `rehype-sanitize`.
Erlaubte Dev-Abhängigkeiten: `typescript`, `@types/*`, `vitest`, `tailwindcss`, `@tailwindcss/postcss`,
`postcss`, `eslint`, `eslint-config-next`.

## User Flow / System Flow / Agent Behavior / API Requirements / Data Model / UI Requirements / States / Telemetry & Events
Nicht zutreffend — Begründung: Entscheidungsdokument.

## Contracts
`package.json` ist der ausführbare Teil dieser Spec.

## Configuration
Siehe Spec 43.

## Edge Cases
1. Benötigte Funktion fehlt → zuerst Standardbibliothek prüfen, dann ADR schreiben, dann Abhängigkeit hinzufügen.
2. Native Abhängigkeit nötig → nicht ohne ADR; Buildrisiko ist explizit zu bewerten.

## Error Handling
`npm ci` muss reproduzierbar durchlaufen; Lockfile ist eingecheckt.

## Security Considerations
Keine Abhängigkeit mit bekannten kritischen Advisories; `npm audit --omit=dev` ohne kritische Funde.

## Performance Budget
Produktionsbuild ≤ 120 s auf Entwicklermaschine.

## Test Plan
`tests/unit/deps.test.ts` prüft, dass `dependencies` exakt der Allowlist entspricht.

## Acceptance Criteria
- `AC-03-01` Given `package.json`, When der Dependency-Test läuft, Then enthält es nur erlaubte Laufzeitabhängigkeiten. (FR-03-07)
- `AC-03-02` Given das Repo, When `npm run build` läuft, Then endet es mit Exitcode 0. (FR-03-01)

## Definition of Done
Build, Typecheck und Dependency-Test grün.

## Dependencies
Keine.

## Implementation Notes
`tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` aus (Kompatibilität mit `openai`).

## Open Decisions
Siehe ADR-002 und ADR-007.
