# AGENTS

This file applies to `src/lib/`.

## Rules

- `client/` is browser-only.
- `server/` is server-only.
- `shared/` is pure and safe for both sides.
- Keep imports moving inward, not across client/server boundaries.
