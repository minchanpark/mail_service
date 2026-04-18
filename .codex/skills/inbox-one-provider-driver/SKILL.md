---
name: inbox-one-provider-driver
description: Use when adding or changing a mail provider driver in Inbox One. Covers the provider registry, account preparation, IMAP/API normalization into the shared Thread model, outbound send transport, secret handling, and the service boundaries that keep provider logic out of routes and UI.
---

# Inbox One Provider Driver

## First read

1. Read [dev/TDD.md](../../../dev/TDD.md), especially the provider, sync, and adapter sections.
2. Read [AGENTS.md](../../../AGENTS.md).
3. Read [src/lib/server/AGENTS.md](../../../src/lib/server/AGENTS.md).
4. Read [src/lib/server/providers/AGENTS.md](../../../src/lib/server/providers/AGENTS.md).
5. If you are editing IMAP code, also read [src/lib/server/providers/imap/AGENTS.md](../../../src/lib/server/providers/imap/AGENTS.md).

## Driver checklist

- Implement the `MailProviderDriver` contract.
- Keep connection metadata in the driver descriptor.
- Keep credential preparation in `prepareAccount()`.
- Normalize external payloads into the shared `Thread` model inside the driver, not in routes.
- Keep outbound transport logic in `sendMail()` inside the driver rather than in services or routes.
- Generate category/action/summary fields through the existing server services/helpers.
- Register the driver in `src/lib/server/providers/registry.ts`.
- Avoid leaking secrets into API responses, shared types, or UI state.

## Do not do

- Do not put provider branching into `src/app/api/**`.
- Do not import IMAP or provider SDK code into `src/components/**` or `src/lib/client/**`.
- Do not invent new thread shapes when the shared `Thread` type can be extended safely.

## Validation

- Run `npm run typecheck`.
- Run `npm run build`.
- If the provider workflow changed, update the provider-related `AGENTS.md` files and the root repo guidance.
