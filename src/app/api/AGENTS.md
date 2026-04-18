# AGENTS

This file applies to `src/app/api/`.

## Rules

- Validate request shape at the route boundary.
- Delegate business logic to `src/lib/server/services/**`.
- Return transport-friendly JSON only.
- Do not put provider logic, persistence logic, or UI formatting here.
- Read the deeper `AGENTS.md` in the specific endpoint directory before editing.
