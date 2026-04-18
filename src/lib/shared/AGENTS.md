# AGENTS

This file applies to `src/lib/shared/`.

## Rules

- Keep this subtree pure and serializable.
- Shared types must be safe for both client and server imports.
- Avoid Node-only or React-only dependencies here.
- Prefer contract stability over local convenience because multiple layers depend on these files.
- Treat this subtree as a compatibility surface first: prefer placing new model contracts in `src/models/**` and pure helpers in `src/other/utils/**`.
- Re-export wrappers here should stay thin and should not grow new business logic.
