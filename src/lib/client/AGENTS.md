# AGENTS

This file applies to `src/lib/client/`.

## Rules

- This subtree is browser-only.
- Talk to the backend through HTTP route handlers, not direct server imports.
- Keep fetch/invalidations/context logic here so components stay simpler.
- Preserve React hook correctness and the current context-based adapter pattern.
