# Insight Agent — UI screenshot improve + ship

## Intent

Open local Insight Agent, click through every UI surface, capture screenshots, mark improvement hotspots with red circles via AI CLI screenshot annotate, then implement the full visual/UX rewrite so the local Chrome app looks and feels premium.

No questions. Infer from PROJECT.md and components/.

## Surfaces to cover

1. Empty chat hero (brand-first first viewport)
2. Sidebar conversation list
3. Header: model picker + mode
4. Setup banner (unconfigured / no search)
5. Composer + send/stop
6. Activity feed during research
7. Sources panel + citation markers
8. Error / retry state

## Design non-negotiables (user frontend rules)

- One composition first viewport; brand "Insight Agent" is hero-level
- No terracotta-on-cream AI default; no purple glow; no Inter/Roboto/Arial/system stacks
- Atmosphere via subtle gradient/mesh, not flat single color
- Cards only where interaction requires; no card clutter in hero
- 2–3 intentional motions (fade-up hero, soft pulse activity, panel slide)
- Desktop + mobile

## Goals

1. Rewrite `app/globals.css`, `app/layout.tsx` (fonts), `components/ChatApp.tsx`, Sidebar, ActivityCard, SourcesPanel for the new look
2. Keep all behavior/API contracts; TDD for any logic changes
3. Update `.cursor/testing/test-coverage-source-of-truth.md` and PROJECT.md
4. Store screenshots + annotated PNGs under `.cursor/design/insight-ui/`
5. Prefer update over delete

## Waves

### Wave 1 — Capture + annotate
- Screenshot each surface; analyze; red-circle annotate regions

### Wave 2 — Visual system
- Tokens, fonts, hero, header, composer

### Wave 3 — Research UX
- Activity + sources + citations polish

## Definition of done

- App runs at http://127.0.0.1:3000
- Visual rewrite visible without keys (setup banner still honest — no fake answers)
- Tests still pass for non-UI suites; any logic change covered
