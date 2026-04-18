# AGENTS

This file applies to `src/components/`.

## Rules

- This subtree now mainly holds compatibility wrappers and any shared presentational pieces that are not page-owned.
- Components should consume data through controllers or client services, never server imports.
- Keep page-owned layout in `src/views/**` and move data orchestration into `src/controllers/**` when reusable.
- Read the deeper subtree `AGENTS.md` before editing an inbox-specific component.
