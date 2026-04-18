# AGENTS

This file applies to `src/lib/server/providers/`.

## Rules

- Keep canonical provider integrations in `src/services/server/providers/**`.
- Leave only compatibility wrappers here unless the task is explicitly about old import support.
- Register new providers through the canonical registry instead of branching elsewhere.
- Do not leak secrets into API responses or shared client state.
