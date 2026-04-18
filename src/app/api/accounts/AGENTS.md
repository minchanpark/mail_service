# AGENTS

This file applies to `src/app/api/accounts/`.

## Rules

- These endpoints expose account-safe data only.
- Never return stored secrets or provider credential material.
- Provider metadata comes from the registry/service layer, not ad hoc route branching.
- Read the local `connect/` or `providers/` guidance before editing those endpoints.
