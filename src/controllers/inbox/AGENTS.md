# AGENTS

This file applies to `src/controllers/inbox/`.

## Rules

- Keep inbox page state in provider-style controllers here.
- Prefer exposing view-friendly values and action methods instead of raw transport details.
- Shared page-specific UI types such as composer intents may live here.
- If a flow is reusable across pages, move it up to `src/controllers/` or `src/services/`.
