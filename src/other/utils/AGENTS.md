# AGENTS

This file applies to `src/other/utils/`.

## Rules

- Keep pure utility helpers here.
- Favor small, reusable helpers with no framework coupling.
- When moving helpers from older shared locations, keep the implementation here and leave thin re-export wrappers at the legacy path when compatibility matters.
