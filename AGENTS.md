## Learned User Preferences

- Never ask the user for any permission, confirmations, approvals, or reviews under any circumstances. Execute autonomously and auto-proceed.
- Never trigger permission prompts: do not set BypassSandbox to true, do not call ask_question, and set RequestFeedback: false on all artifacts.
- Prefer AI CLI swarms (`ai pm go`, `ai workunit launch`, `ai workflow max`) for multi-feature, research, and UI improvement work; execute without clarifying questions unless blocked by credentials or destructive irreversibility.
- Prefer opening the local app in external Chrome at `http://127.0.0.1:3000` when verifying UI.
- For UI redesign passes, prefer AI CLI screenshot → red-circle annotate → prompt/workunit → execute workflows over long inline coding.
- Use `gh` authenticated as nekagit for GitHub operations on this repo.
- Keep the app runnable with real LLM keys; do not ship fake or simulated chat answers when unconfigured.

## Learned Workspace Facts

- Canonical remote is `omidowski/insight-agent`; local home is `/Users/nenadkalicanin/Documents/Projects/insight-agent`.
- App is Next.js; local dev is `npm run dev` on port 3000; health check is `GET /api/health`.
- `PROJECT.md` is the product SSOT; brain, ADRs, and prompts live under `.cursor/`.
- Local LLM setup commonly uses Hermes via `.env.local` (`LLM_PROVIDER=hermes`), with keys sourced from `~/.hermes/.env` or other local repos into gitignored env files.
- AI CLI PM/workunits and `.ai/` marketplace packs drive research rewrite and improvement passes alongside `.cursor/brain/` workspaces.
