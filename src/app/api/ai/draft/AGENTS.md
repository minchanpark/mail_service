# AGENTS

This file applies to `src/app/api/ai/draft/`.

## Rules

- Validate draft-generation intent at the route boundary.
- Keep AI draft prompting and variant generation inside `src/lib/server/services/**`.
- Preserve a stable JSON contract for compose/reply/forward draft variants.
