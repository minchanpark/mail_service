---
name: inbox-one-development
description: Use when working on the Inbox One / mail_service repository. Covers the Next.js inbox app, MVC-style client structure (`services -> controllers -> views`), route handlers, file-backed demo store, AI summary/reply/compose services, outbound mail send flows, and the shared architecture rules for this codebase. Trigger when adding features, fixing bugs, refactoring UI, changing APIs, updating store/service boundaries, or maintaining AGENTS/hook/skill guidance in this repo.
---

# Inbox One Development

## First read

1. Read [README.md](../../../README.md).
2. Read [dev/TDD.md](../../../dev/TDD.md) and [dev/PRD.md](../../../dev/PRD.md) for product and architecture intent.
3. Read [AGENTS.md](../../../AGENTS.md).
4. If the task touches `src`, read `src/AGENTS.md` and every deeper `AGENTS.md` on the target path before editing.

## Architecture guardrails

- Keep `src/app/api/**` thin. Validate input and delegate to services.
- Keep shared models and serializable contracts inside `src/models/**`.
- Keep browser-facing API mapping inside `src/services/api/**`.
- Keep reusable low-level client hooks and context inside `src/services/client/**`.
- Keep request auth/session guards, business logic, providers, and persistence inside `src/services/server/**`.
- Keep page state orchestration inside `src/controllers/**`.
- Keep page-oriented UI inside `src/views/**`.
- Keep pure cross-cutting helpers and theme utilities in `src/other/**`.
- Do not import server modules into client components or client hooks.
- Do not move provider or persistence logic into route handlers or UI components.
- Keep draft generation and send orchestration in services, and keep SMTP/API transport details in providers.
- Treat `src/lib/**` and `src/components/**` as compatibility surfaces unless a task is explicitly about those shims.

## Typical edit order

1. Shared types/contracts if needed.
2. Server store/provider/service logic.
3. App route handlers.
4. Client service/controller wiring.
5. View files and compatibility wrappers.
6. Docs and AGENTS updates.

## Validation

- Run `npm run typecheck`.
- Run `npm run build`.
- If the task adds repo-local audit or profiling workflows, keep `.codex/skills/**`, helper scripts, and `package.json` commands aligned.
- If architecture or workflow changed, update root/subtree `AGENTS.md`, `.codex/hooks.json`, and the relevant project skill.
- When work touches package/config security surfaces, use `web-security-audit`.
- When work touches route validation, provider trust boundaries, secret handling, or send safety, use `inbox-one-security-review`.
- When work touches AI summary/reply/draft flows, use `inbox-one-llm-safety`.

## When adding new directories

- Every new directory under `src` must get its own `AGENTS.md` in the same change.
- The root `AGENTS.md` stays concise; push detailed rules down into the nearest subtree file.
