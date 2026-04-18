# AGENTS

This file applies to `src/lib/server/services/`.

## Rules

- This subtree owns business logic and orchestration.
- Routes should call services; services may call providers/store/helpers.
- Keep policy, filtering, sanitization, and view-model assembly here rather than in routes.
- Update service-level docs when contracts or orchestration flow changes.
- Mail draft generation, send orchestration, sent-thread persistence, and post-send state updates belong here.
