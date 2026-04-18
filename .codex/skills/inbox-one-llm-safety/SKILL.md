---
name: inbox-one-llm-safety
description: Use when reviewing Inbox One AI features for prompt-injection, unsafe automation, data leakage, and model-boundary issues. Trigger when changing ai-service logic, /api/ai/* routes, AI draft/reply/summary flows, composer prompt handling, future model integrations, or when the user asks for prompt-injection review, LLM safety review, AI guardrail review, or data-leakage review in this repo.
---

# Inbox One LLM Safety

Use this skill for **AI-flow and prompt-boundary review** in Inbox One.

This skill complements:

- `web-security-audit` for dependency/header/config checks
- `inbox-one-security-review` for application-layer auth, secret, SSRF, and persistence review

## First read

1. Read [README.md](../../../README.md).
2. Read [dev/TDD.md](../../../dev/TDD.md), especially AI, prompt, and data-retention sections.
3. Read [AGENTS.md](../../../AGENTS.md).
4. Review the nearest `AGENTS.md` files for any touched AI or API subtree.

## Primary review targets

- `src/lib/server/services/ai-service.ts`
- `src/app/api/ai/**`
- `src/views/inbox/mail-compose-sheet.tsx`
- Any future provider code that calls external LLM APIs

## What to look for

1. Prompt boundary confusion
   Email content is untrusted input. It must never be treated like system instructions.
2. Unsafe automation
   AI output may suggest replies, drafts, or classifications, but it must not directly send mail or mutate high-trust state without explicit user action.
3. Sensitive data leakage
   Check what message content, account context, recipients, or internal metadata are sent to the model.
4. Render safety
   AI-generated summaries and drafts should render as plain text unless there is a deliberate sanitization layer.
5. User prompt handling
   Extra user instructions should stay bounded and should not silently override high-level product rules.
6. Retention and provider assumptions
   When real external models are introduced, call out retention, logging, redaction, and model-provider data handling.

## Review checklist

- Treat all incoming email content as adversarial prompt input.
- Separate system/product rules from message text and user free-form instructions.
- Confirm AI output is advisory until the user explicitly applies or sends it.
- Check that model calls do not include unnecessary credentials, raw secrets, or unrelated mailbox content.
- Flag any place where AI output could influence provider choice, account routing, or send transport directly.
- Prefer deterministic server-side rules for classification or safety-critical actions over model-only decisions.

## How to report findings

- Lead with prompt injection or unsafe automation issues first.
- Include the exact trust boundary that is being crossed: message body, user prompt, model output, or send action.
- Distinguish between `current local mock risk`, `future external-model risk`, and `production blocker`.
- If the problem is really route validation or auth, hand it off to `inbox-one-security-review`.

## Out of scope

- Dependency CVEs, CSP, headers, or bundled library scanning.
  Use `web-security-audit`.
- General route validation, secret storage, SSRF, and authorization review.
  Use `inbox-one-security-review`.
