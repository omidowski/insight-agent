# Implementation — IAAR-0201

- Extracted `evaluateGaps` to `lib/agent/research/gaps.ts`
- `runResearchLoop` imports shared gap helper (dedupe + weak-evidence rules)
- Engine uses `diversifyQueries` / `normalizeQuery` for Spec 25 FR-25-02
