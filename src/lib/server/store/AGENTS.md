# AGENTS

This file applies to `src/lib/server/store/`.

## Rules

- The current store is a file-backed demo persistence layer.
- Preserve deterministic seed bootstrapping and safe read/write behavior.
- Keep file-system details here, not in routes or services.
- If the storage backend changes later, keep the service API stable while swapping implementation here.
