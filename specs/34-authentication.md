---
id: 34-authentication
title: Authentication
phase: 8
milestone: V1
status: draft
depends_on: [08-api-surface]
provides: [auth]
complexity: M
---

# Authentication

> Kurzform-Spec (V1/V2). Vor der Implementierung ins Vollformat aus `PROMPT-1` überführen.

## Purpose
Mehrbenutzerbetrieb mit Login, Sessions und Abmeldung.

## Functional Requirements
- `FR-34-01` E-Mail/Passwort mit Argon2id sowie mindestens ein OAuth-Anbieter.
- `FR-34-02` Sessions als httpOnly-, secure-, sameSite=lax-Cookies mit 30 Tagen Gültigkeit.
- `FR-34-03` `AUTH_ENABLED=false` MUSS den MVP-Einzelnutzerbetrieb unverändert erhalten.
- `FR-34-04` Nicht authentifizierte Zugriffe MÜSSEN `401` liefern, wenn Auth aktiv ist.
- `FR-34-05` Passwortzurücksetzung über signierte, kurzlebige Token.

## Acceptance Criteria
- `AC-34-01` Given `AUTH_ENABLED=true` und keine Session, When `/api/runs`, Then `401`.
- `AC-34-02` Given `AUTH_ENABLED=false`, Then verhält sich die App wie im MVP.

## Dependencies
08.
