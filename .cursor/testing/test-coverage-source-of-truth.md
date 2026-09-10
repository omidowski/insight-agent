# Test coverage — single source of truth

Product: insight-agent  
Updated: 2026-09-09

## Rule

Any source file change requires corresponding test coverage and an update to this checklist.

## Runner

- Primary: `npm test` (vitest)
- Full gate: `npm run verify`
- Prefer Bun when `bunfig` / bun lock present (not currently)

## Coverage map (MVP baseline)

| Area | Source | Tests expected |
|------|--------|----------------|
| Research engine | `lib/agent/research/*` | query gen, excerpt verify, empty-source, saturation |
| Deep loop | `lib/agent/research/loop.ts` | gaps, budget stop, cancel |
| Search providers | `lib/search/*` | failover, no fake fill |
| Tools | `lib/tools/*` | guards, SSRF, timeouts |
| Router/orchestrator | `lib/agent/router.ts`, `orchestrator.ts` | live-fact → web_lookup; title resolve |
| LLM | `lib/llm/*` | provider selection, no fixture production path |
| API/SSE | `app/api/*` | contracts, cancel, redaction |
| UI reducers | `components/*` / client reducers | activity + sources events |

## AI CLI enhance wave

- [x] Query diversity / non-repeat queries — `lib/agent/research/query-diversity.ts`
- [x] Multi-provider search failover — `lib/search/failover.ts`
- [x] Gap listing harden — `lib/agent/research/gaps.ts`
- [x] Conversation title resolve — `lib/agent/title.ts` + `tests/unit/conversation-title.test.ts`
- [x] Local Hermes `.env.local` + UI polish
- [ ] ClaimKey normalization edge cases
- [ ] Eval harness starter (spec 41)
- [ ] RAG/doc retrieval hooks (specs 22/32)

## Last verification

- http://127.0.0.1:3000 with `LLM_PROVIDER=hermes` (configured + search)
- Unit: conversation-title + failover + gaps → 14 passed
