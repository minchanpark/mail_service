# AGENTS

This file applies to `src/lib/shared/`.

## Rules

- Keep this subtree pure and serializable.
- Shared types must be safe for both client and server imports.
- Avoid Node-only or React-only dependencies here.
- Prefer contract stability over local convenience because multiple layers depend on these files.
