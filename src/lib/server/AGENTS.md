# AGENTS

This file applies to `src/lib/server/`.

## Rules

- This subtree is server-only.
- Keep React, DOM, and browser APIs out of it.
- Services orchestrate behavior, providers integrate remote mail systems, and store handles persistence.
- Read the deeper subtree `AGENTS.md` before editing providers, services, or store code.
