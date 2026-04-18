# AGENTS

This file applies to `src/services/`.

## Rules

- This subtree owns the non-UI service layer.
- `api/` maps backend endpoints for the browser.
- `client/` owns low-level browser hooks, context, and client-side dependency injection.
- `server/` owns server-only auth, business logic, providers, and persistence helpers.
- Keep each deeper subtree focused on its role and read the nearest `AGENTS.md` before editing there.
