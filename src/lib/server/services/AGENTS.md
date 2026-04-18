# AGENTS

This file applies to `src/lib/server/services/`.

## Rules

- Keep canonical business logic in `src/services/server/services/**`.
- Leave only compatibility wrappers here unless the task is explicitly about old import support.
- Routes should call the canonical services layer; wrappers here exist only for migration safety.
