# AGENTS

This file applies to the whole repository.

## Read order

1. Read [README.md](./README.md).
2. Read [dev/TDD.md](./dev/TDD.md) and [dev/PRD.md](./dev/PRD.md) for intended product and architecture behavior.
3. Read this file.
4. If you touch `src/**`, read [src/AGENTS.md](./src/AGENTS.md) and then every deeper `AGENTS.md` on the target path before editing.

Example:
If you edit `src/lib/server/providers/imap/driver.ts`, read:
- `AGENTS.md`
- `src/AGENTS.md`
- `src/lib/AGENTS.md`
- `src/lib/server/AGENTS.md`
- `src/lib/server/providers/AGENTS.md`
- `src/lib/server/providers/imap/AGENTS.md`

## Core rules

- Keep App Router route handlers thin in `src/app/api/**`.
- Keep shared contracts and serializable data models in `src/models/**`.
- Keep browser API mapping in `src/services/api/**`.
- Keep low-level browser hooks and reusable client helpers in `src/services/client/**`.
- Keep request auth/session helpers in `src/services/server/auth/**`.
- Keep business logic in `src/services/server/**`.
- Keep provider-specific integration in `src/services/server/providers/**`.
- Keep persistence in `src/services/server/store/**`.
- Keep page state orchestration in `src/controllers/**`.
- Keep page-oriented UI in `src/views/**`.
- Keep cross-cutting pure utilities and theme helpers in `src/other/**`.
- Do not import server modules into client code.
- Do not move provider logic into routes or components.
- Preserve the provider registry/driver pattern when adding new mail servers.
- Keep the file-backed demo store working unless the task explicitly replaces it.
- Treat `src/lib/**` and `src/components/**` as compatibility surfaces unless a task explicitly restores them as primary implementation layers.
- When touching `src/views/**`, also read the matching controller and service `AGENTS.md` on that page path if they exist.

## Documentation rules

- Root `AGENTS.md` stays short and cross-cutting.
- Put detailed instructions in the nearest subtree `AGENTS.md`.
- If you create a new directory under `src`, add `AGENTS.md` there in the same change.
- If architecture or workflow changes, update the affected `AGENTS.md`, `.codex/skills/**`, and `.codex/hooks.json` together.

## Project automation

- Project skills live in `.codex/skills/**`.
- Project hooks are registered in `.codex/hooks.json` and implemented in `.codex/hooks/**`.
- Tool-backed quality skills should keep their required npm packages and runnable scripts in sync with `package.json`.
- For horizontal security changes such as `package.json`, `package-lock.json`, `next.config.*`, `proxy.ts`, or `middleware.ts`, use `web-security-audit`.
- For app-layer security review such as auth, provider trust boundaries, secret handling, and send safety, use `inbox-one-security-review`.
- For AI summary/draft/reply guardrails and prompt-boundary review, use `inbox-one-llm-safety`.

## Validation

- For code changes, run `npm run typecheck` and `npm run build`.
- Final notes should mention any warnings, skipped checks, or doc files updated alongside the code.
