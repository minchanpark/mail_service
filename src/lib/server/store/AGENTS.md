# AGENTS

This file applies to `src/lib/server/store/`.

## Rules

- Keep canonical persistence in `src/services/server/store/**`.
- Leave only compatibility wrappers here unless the task is explicitly about old import support.
- Preserve deterministic seed bootstrapping and safe read/write behavior in the canonical store layer.
