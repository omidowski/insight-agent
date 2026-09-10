---
title: UX lifecycle — interruption recovery
aliases: []
tags: [aicli/setup]
status: active
type: rule
product: ai
created: 2026-09-09
updated: 2026-09-09
---

# UX lifecycle

Seeded by `ai setup workspace` (ADR 1270 / 1271).

| State | Sign-in | Use app | Expected UX |
|---|---|---|---|
| `no_update` | Yes | Yes | Normal |
| `update_available_optional` | Yes | Yes | Non-blocking banner |
| `update_required_pre_auth` | No | No | Full-screen mandatory gate |
| `downloading_required_update` | No | No | Full-screen progress + resume |
| `installing_required_update` | No | No | Installer handoff |
| `awaiting_post_install_resume` | No | No | On reopen continue same update |
| `update_failed_retryable` | No | No | Retry / diagnostics |
| `update_deferred_optional` | Yes | Yes | Reminder only |

## Ticket checklist

- [ ] Launch interruption handled
- [ ] Process kill / reopen resume handled
- [ ] Required vs optional policy tested
- [ ] Auth blocked while required update pending
