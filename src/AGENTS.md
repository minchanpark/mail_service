# AGENTS

This file applies to everything under `src/`.

## Before editing

- Read the root [AGENTS.md](../AGENTS.md).
- Read this file.
- Then read the nearest deeper `AGENTS.md` for the exact subtree you are touching.

## Directory map

- `app/` : App Router entrypoints and route handlers.
- `components/` : thin compatibility wrappers when older import paths still need to resolve.
- `controllers/` : provider-style page state orchestration.
- `models/` : shared serializable data models and contracts.
- `services/` : browser-facing API mapping, client helpers, and server-side service implementations.
- `views/` : page-oriented UI files.
- `other/` : pure utilities and theme helpers.
- `lib/` : compatibility wrappers for older import paths while the new layout settles.

## Cross-layer rule

- Prefer changes from the bottom up: model/utility -> server logic -> route handler -> client adapter/hook -> controller -> view.
- If you change a contract or responsibility boundary, update the local `AGENTS.md` files on that path.
