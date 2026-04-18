# AGENTS

This file applies to `src/other/`.

## Rules

- Put cross-cutting pure utilities and theme helpers here.
- Keep this subtree free of server-only or browser-only side effects unless a deeper subtree explicitly scopes that.
- Prefer `utils/` for reusable logic and keep legacy compatibility wrappers out of this subtree.
