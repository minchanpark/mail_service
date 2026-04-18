---
name: inbox-one-development
description: Use when working on the Inbox One / mail_service repository. Covers the Next.js inbox app, route handlers, client HTTP adapter, file-backed demo store, AI summary/reply services, and the shared architecture rules for this codebase. Trigger when adding features, fixing bugs, refactoring UI, changing APIs, updating store/service boundaries, or maintaining AGENTS/hook/skill guidance in this repo.
---

# Inbox One Development

## First read

1. Read [README.md](../../../README.md).
2. Read [dev/TDD.md](../../../dev/TDD.md) and [dev/PRD.md](../../../dev/PRD.md) for product and architecture intent.
3. Read [AGENTS.md](../../../AGENTS.md).
4. If the task touches `src`, read `src/AGENTS.md` and every deeper `AGENTS.md` on the target path before editing.

## Architecture guardrails

- Keep `src/app/api/**` thin. Validate input and delegate to services.
- Keep browser-facing data access inside `src/lib/client/**`.
- Keep business logic in `src/lib/server/services/**`.
- Keep persistence concerns in `src/lib/server/store/**`.
- Keep provider-specific code in `src/lib/server/providers/**`.
- Keep shared types and serializable helpers in `src/lib/shared/**`.
- Do not import server modules into client components or client hooks.
- Do not move provider or persistence logic into route handlers or UI components.

## Typical edit order

1. Shared types/contracts if needed.
2. Server store/provider/service logic.
3. App route handlers.
4. Client adapter/hooks.
5. UI components.
6. Docs and AGENTS updates.

## Validation

- Run `npm run typecheck`.
- Run `npm run build`.
- If architecture or workflow changed, update root/subtree `AGENTS.md`, `.codex/hooks.json`, and the relevant project skill.

## When adding new directories

- Every new directory under `src` must get its own `AGENTS.md` in the same change.
- The root `AGENTS.md` stays concise; push detailed rules down into the nearest subtree file.
