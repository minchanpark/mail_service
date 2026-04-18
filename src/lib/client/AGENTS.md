# AGENTS

This file applies to `src/lib/client/`.

## Rules

- This subtree is browser-only.
- Keep files here as thin compatibility wrappers while the primary implementation lives in `src/services/client/**` and `src/services/api/**`.
- Talk to the backend through HTTP route handlers, not direct server imports.
- Do not reintroduce substantive client hook or context logic here.
- Preserve React hook correctness and the current context-based adapter pattern.
