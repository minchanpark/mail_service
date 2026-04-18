# AGENTS

This file applies to `src/services/client/`.

## Rules

- Keep low-level browser hooks, client context, and resource-loading helpers here.
- This subtree may depend on `src/services/api/**` and `src/models/**`.
- Do not import server-only modules here.
