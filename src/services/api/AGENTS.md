# AGENTS

This file applies to `src/services/api/`.

## Rules

- Map backend route handlers into stable client-side service methods here.
- Keep fetch helpers and resource invalidation around API wrappers in this subtree.
- If older imports still expect a client context module here, keep it as a thin compatibility re-export to `src/services/client/**`.
- Preserve compatibility exports when moving older `src/lib/client/**` service code.
- Do not place page state or UI logic here.
