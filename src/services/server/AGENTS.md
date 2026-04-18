# AGENTS

This file applies to `src/services/server/`.

## Rules

- This subtree is server-only.
- Put auth, business logic, providers, and persistence here under feature-appropriate subdirectories.
- Keep route handlers thin and import server logic from here.
