---
title: Gemini CLI — Google AI Pro OAuth
aliases: []
tags: [aicli/setup]
status: active
type: llm-rule
product: ai
created: 2026-09-09
updated: 2026-09-09
---

# Gemini CLI — Google AI Pro OAuth

## Configured

- Binary: `gemini` (npm `@google/gemini-cli`)
- Auth mode: `oauth-personal` in `~/.gemini/settings.json`
- Preferred account: `njoco@hotmail.de`
- Do **not** set `GEMINI_API_KEY` / `GOOGLE_API_KEY` for Pro contingent

## Finish login (interactive)

```bash
unset GEMINI_API_KEY GOOGLE_API_KEY
export HOME=/home/kw
gemini
```

Complete Sign in with Google as `njoco@hotmail.de`. After login, `~/.gemini/oauth_creds.json` appears.
