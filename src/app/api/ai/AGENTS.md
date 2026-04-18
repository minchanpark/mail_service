# AGENTS

This file applies to `src/app/api/ai/`.

## Rules

- AI endpoints are transport wrappers only.
- Prompting, summarization, reply generation, and classification logic belong in server services.
- Keep request/response contracts stable and serializable.
