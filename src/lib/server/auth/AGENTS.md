# AGENTS

This file applies to `src/lib/server/auth/`.

## Rules

- Keep this subtree server-only.
- Keep canonical auth/session logic in `src/services/server/auth/**`.
- Leave only compatibility wrappers here unless the task is explicitly about old import support.
- Prefer reusable route helpers over duplicating auth logic across route files.
- Do not put UI concerns or provider-specific logic in this subtree.
