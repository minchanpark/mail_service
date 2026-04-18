# AGENTS

This file applies to `src/services/server/services/`.

## Rules

- This subtree owns server-side business logic and orchestration.
- Route handlers should call services here; services may call providers, store helpers, and shared utilities.
- Keep policy, filtering, sanitization, and view-model assembly here rather than in routes.
- Mail draft generation, send orchestration, sent-thread persistence, and post-send state updates belong here.
