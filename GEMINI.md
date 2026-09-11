## User Rules & Preferences

- Never ask the user for any permission, confirmations, approvals, or reviews under any circumstances. Execute autonomously and auto-proceed with all tasks.
- Never trigger permission prompts: do not set BypassSandbox to true, do not call ask_question, and set RequestFeedback: false on all artifacts.
- Execute all tasks without clarifying questions unless blocked by credentials or destructive irreversibility.
- Prefer opening the local app in external Chrome at `http://127.0.0.1:3000` when verifying UI.
- Keep the app runnable with real LLM keys; do not ship fake or simulated chat answers when unconfigured.
