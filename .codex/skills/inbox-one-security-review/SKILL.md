---
name: inbox-one-security-review
description: Use when reviewing Inbox One for application and business-logic security issues beyond dependency and header audits. Trigger when changing auth, account connect flows, provider drivers, route validation, mail send behavior, thread patch/update logic, file-backed persistence, secret handling, or custom IMAP/SMTP host input. Also use when the user asks for a code security review, auth review, SSRF review, mass-assignment review, secret exposure check, or OWASP-style app-layer review in this repo.
---

# Inbox One Security Review

Use this skill for **vertical security review** of the Inbox One codebase.

This skill complements `web-security-audit`:

- `web-security-audit` covers dependencies, bundled JS, headers, CSP, and static Next.js config.
- `inbox-one-security-review` covers route validation, secret handling, auth assumptions, provider boundaries, mail-send safety, and persistence risks.

## First read

1. Read [README.md](../../../README.md).
2. Read [dev/TDD.md](../../../dev/TDD.md) and [dev/PRD.md](../../../dev/PRD.md) for trust boundaries and intended behavior.
3. Read [AGENTS.md](../../../AGENTS.md).
4. If the review touches `src`, read the nearest `AGENTS.md` files on the affected path.

## Primary review targets

- `src/app/api/**`
  Check route-level validation, allowed fields, and transport-safe error behavior.
- `src/lib/server/services/**`
  Check orchestration boundaries, object patch/merge behavior, and user/account scoping assumptions.
- `src/lib/server/providers/**`
  Check secret handling, custom host input, remote network boundaries, and send/sync safety.
- `src/lib/server/store/**`
  Check what gets persisted locally, especially secrets and message content.

## Hotspots in this repo

1. Thread patch routes
   Watch for mass-assignment style updates where `Partial<Thread>` or unbounded JSON can mutate fields that should stay server-controlled.
2. Account connect and provider setup
   Review whether secrets stay server-side and whether custom IMAP/SMTP host input creates SSRF-like or internal-network reachability risk.
3. Mail send flows
   Confirm mail is only sent on explicit user action, and that AI-generated content never bypasses that action.
4. File-backed persistence
   Treat stored account secrets, message content, and local report artifacts as sensitive even in demo mode.
5. Multi-user assumptions
   The app is demo-oriented, but still call out where APIs assume a single local user and would need authorization checks before production use.

## Review checklist

- Input validation
  Ensure route handlers validate payload shape tightly and do not pass arbitrary JSON into services.
- Secret exposure
  Ensure account `secrets` never flow into API responses, client state, logs, or generated reports.
- Authorization boundary
  Check whether route handlers and services verify that the current user owns the target account/thread/label.
- External network safety
  Flag user-controlled hostnames, ports, or protocols that can reach unexpected internal services.
- Data minimization
  Flag cases where raw email bodies, headers, or attachments are stored or returned unnecessarily.
- State integrity
  Check that server-owned fields such as provider IDs, source thread metadata, and derived summary/category values cannot be forged from the client.

## How to report findings

- Put exploitable issues first: auth bypass, secret leakage, SSRF, unsafe patch semantics, unintended send behavior.
- Include exact file references and the concrete attacker-controlled input or misuse path.
- Distinguish clearly between `demo-only risk`, `production blocker`, and `hardening recommendation`.
- If the issue is mostly horizontal security, hand it off back to `web-security-audit`.

## Out of scope

- Dependency CVEs, HTTP headers, CSP quality, and bundle-library scanning.
  Use `web-security-audit`.
- Prompt injection and model-behavior risks in AI summary/draft flows.
  Use `inbox-one-llm-safety`.
