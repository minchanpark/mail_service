# AGENTS

This file applies to `src/lib/server/auth/`.

## Rules

- Keep this subtree server-only.
- Centralize request authentication, origin checks, and access-policy helpers here.
- Prefer reusable route helpers over duplicating auth logic across route files.
- Do not put UI concerns or provider-specific logic in this subtree.
