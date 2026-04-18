# AGENTS

This file applies to `src/lib/`.

## Rules

- Treat this subtree as compatibility wrappers for older imports while the primary implementation lives in `src/models/**`, `src/services/**`, and `src/other/**`.
- `client/` wrappers must stay browser-safe.
- `server/` wrappers must stay server-only.
- `shared/` wrappers must stay pure and safe for both sides.
- Keep wrappers thin and avoid reintroducing business logic here.
