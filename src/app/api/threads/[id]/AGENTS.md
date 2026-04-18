# AGENTS

This file applies to `src/app/api/threads/[id]/`.

## Rules

- Keep GET/PATCH endpoints thin.
- Route params and patch validation belong here; merge semantics belong in services.
- Avoid UI-specific formatting in the JSON response.
