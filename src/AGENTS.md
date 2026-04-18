# AGENTS

This file applies to everything under `src/`.

## Before editing

- Read the root [AGENTS.md](../AGENTS.md).
- Read this file.
- Then read the nearest deeper `AGENTS.md` for the exact subtree you are touching.

## Directory map

- `app/` : App Router entrypoints and route handlers.
- `components/` : thin compatibility wrappers or shared presentational composition.
- `controllers/` : provider-style page state orchestration.
- `services/` : browser-facing API mapping and service contexts.
- `views/` : page-oriented UI files.
- `lib/client/` : browser adapters, hooks, and context.
- `lib/server/` : server-only services, providers, and storage.
- `lib/shared/` : shared serializable types and small pure helpers.

## Cross-layer rule

- Prefer changes from the bottom up: shared contract -> server logic -> route handler -> client adapter/hook -> component.
- If you change a contract or responsibility boundary, update the local `AGENTS.md` files on that path.
