# AGENTS

This file applies to `src/app/api/accounts/providers/`.

## Rules

- Return static provider descriptors for the connect UI.
- Do not probe live servers or expose secrets from this endpoint.
- Descriptor shape should stay aligned with the provider registry.
