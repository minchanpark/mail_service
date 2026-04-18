# AGENTS

This file applies to `src/lib/server/`.

## Rules

- This subtree is server-only.
- Canonical server implementations now live under `src/services/server/**`.
- Keep React, DOM, and browser APIs out of it.
- Keep files here as thin compatibility wrappers while older imports are migrated.
- Do not add new business logic here unless the task is explicitly about compatibility shims.
- Read the deeper subtree `AGENTS.md` before editing auth, providers, services, or store code.
