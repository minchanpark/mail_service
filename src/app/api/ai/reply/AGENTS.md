# AGENTS

This file applies to `src/app/api/ai/reply/`.

## Rules

- Validate `threadId` only and delegate to the reply service.
- Keep tone/body generation logic out of the route file.
