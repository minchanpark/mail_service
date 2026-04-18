# AGENTS

This file applies to `src/lib/client/`.

## Rules

- This subtree is browser-only.
- Talk to the backend through HTTP route handlers, not direct server imports.
- Keep reusable low-level hooks and client helpers here.
- Prefer `src/services/api/**` for service definitions and `src/controllers/**` for page state orchestration.
- Preserve React hook correctness and the current context-based adapter pattern.
