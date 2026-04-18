# AGENTS

This file applies to `src/models/`.

## Rules

- Put shared serializable data models and contracts here.
- Keep this subtree pure and safe for both client and server imports.
- Prefer stable names and small files because many layers depend on these models.
- Prefer domain-focused files (account, thread, mail, briefing, app-state) over catch-all type dumps.
- Export shared model entrypoints from `src/models/index.ts` when you add new reusable contracts.
