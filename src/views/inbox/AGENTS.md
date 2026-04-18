# AGENTS

This file applies to `src/views/inbox/`.

## Rules

- Keep Inbox One page UI, layout fragments, and page-local helpers in this subtree.
- Use `src/controllers/inbox/**` for shared page state and actions.
- Use `src/services/api/**` for backend service access, either through controllers or narrowly scoped local hooks.
- If a view file grows materially, split it by page concern such as `sections`, `sheet`, or `primitives`.
