# AGENTS

This file applies to `src/services/api/`.

## Rules

- Map backend route handlers into stable client-side service methods here.
- Keep fetch helpers, resource invalidation, and service context in this subtree.
- Preserve compatibility exports when moving older `src/lib/client/**` service code.
- Do not place page state or UI logic here.
