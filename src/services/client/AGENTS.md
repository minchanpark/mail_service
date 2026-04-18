# AGENTS

This file applies to `src/services/client/`.

## Rules

- Keep low-level browser hooks, client context, and resource-loading helpers here.
- This is the primary home for client-side hooks and context that older code may still import from `src/lib/client/**`.
- This subtree may depend on `src/services/api/**` and `src/models/**`.
- Do not import server-only modules here.
