# AGENTS

This file applies to `src/app/api/mail/send/`.

## Rules

- Validate recipients, mode, and message body at the route boundary.
- Do not construct SMTP payloads here; delegate to the mail send service.
- Keep response JSON focused on delivery status and the created sent-thread record.
