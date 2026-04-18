# AGENTS

This file applies to `src/app/api/accounts/connect/`.

## Rules

- Keep this endpoint limited to payload validation and `connectAccount()` delegation.
- Do not add provider-specific connection logic here.
- Credential handling belongs in provider drivers and server services only.
