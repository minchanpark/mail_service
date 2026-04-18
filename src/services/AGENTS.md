# AGENTS

This file applies to `src/services/`.

## Rules

- This subtree owns browser-facing service definitions and API mapping.
- Keep service files focused on transport, request building, invalidation, and dependency injection.
- Do not import server-only modules here.
- Controllers may depend on services; services must not depend on page views.
