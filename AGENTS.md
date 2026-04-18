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
- Keep browser API mapping in `src/services/api/**`.
- Keep page state orchestration in `src/controllers/**`.
- Keep page-oriented UI in `src/views/**`.
- Keep low-level browser hooks and reusable client helpers in `src/lib/client/**`.
- Keep business logic in `src/lib/server/services/**`.
- Keep provider-specific integration in `src/lib/server/providers/**`.
- Keep persistence in `src/lib/server/store/**`.
- Keep shared contracts and serializable helpers in `src/lib/shared/**`.
- Do not import server modules into client code.
- Do not move provider logic into routes or components.
- Preserve the provider registry/driver pattern when adding new mail servers.
- Keep the file-backed demo store working unless the task explicitly replaces it.
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

## Validation

- For code changes, run `npm run typecheck` and `npm run build`.
- Final notes should mention any warnings, skipped checks, or doc files updated alongside the code.
