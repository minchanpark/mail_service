# AGENTS

This file applies to `src/app/api/mail/`.

## Rules

- Mail transport endpoints are thin wrappers around server services.
- Validate send payloads here and keep SMTP/provider orchestration in `src/services/server/services/**`.
- Return serializable delivery results only.
