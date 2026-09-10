# Insight Agent — improve pass

## Intent
Continue improving Insight Agent UX and reliability. PROJECT.md is SSOT. No questions.

## Done already (do not regress)
- Hermes `.env.local` local provider
- Brand-first UI (ADR-002)
- Conversation title resolve helper
- Query diversity + search failover

## Next slices (TDD)
1. Conversation list refresh after title rename (sidebar titles)
2. Activity feed readability + sources panel contrast
3. Keyboard: Cmd+Enter send; autofocus after example pick
4. Fix any remaining Neuer Chat / AC-11 regressions
5. Eval harness starter if time

Prefer update over delete. Bun/npm test before done.
