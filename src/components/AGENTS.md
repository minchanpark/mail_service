# AGENTS

This file applies to `src/components/`.

## Rules

- Components should consume data through client hooks/adapters, never server imports.
- Keep visual logic here and move data orchestration into `src/lib/client/**` when reusable.
- Read the deeper subtree `AGENTS.md` before editing an inbox-specific component.
