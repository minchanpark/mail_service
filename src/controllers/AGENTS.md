# AGENTS

This file applies to `src/controllers/`.

## Rules

- Controllers own provider/context-based state orchestration for views.
- Controllers may combine services and low-level client hooks into view-friendly state and actions.
- Keep controller state serializable where practical and expose clear action methods for views.
- Do not place JSX-heavy page layout here.
