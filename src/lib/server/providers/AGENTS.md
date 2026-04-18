# AGENTS

This file applies to `src/lib/server/providers/`.

## Rules

- Provider integrations must implement the shared driver contract.
- Register new providers through the registry instead of branching elsewhere.
- Normalize external payloads into shared `Thread` objects inside provider code.
- Do not leak secrets into API responses or shared client state.
