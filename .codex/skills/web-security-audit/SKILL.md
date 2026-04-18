---
name: web-security-audit
description: Use when checking this web service for security issues such as vulnerable dependencies, vulnerable bundled JavaScript libraries, missing HTTP security headers, weak CSP policies, and unsafe local web defaults. Trigger when the user asks for a web security review, security audit, vulnerability check, OWASP-style sanity check, dependency risk check, or header hardening review. Also trigger automatically when package.json, package-lock.json, next.config.js, next.config.ts, next.config.mjs, middleware.ts, or proxy.ts are modified.
---

# Web Security Audit

Use this skill when auditing the local web app for practical security issues.

## Tools installed in this repo

- `audit-ci`
- `retire`
- `node` built-in `fetch`

By default, dependency audit runs in **runtime-focused mode** with `--skip-dev` so diagnostics from repo-local profiling tools do not drown out real production risk. Use a full-tree audit separately when you explicitly want dev-tool exposure.

## What this skill checks

1. Dependency vulnerabilities from the active lockfile (`audit-ci`).
2. Known vulnerable JavaScript libraries in the repo tree (`retire`).
3. HTTP security headers on a running local service (`check-security-headers.mjs`).
4. CSP policy quality, not just presence — flags `unsafe-inline`, `unsafe-eval`, and wildcard script/style sources.
5. Next.js static config — evaluates `next.config.*` and `proxy.ts` / `middleware.ts` without running the server.
6. Obvious local misconfigurations such as wildcard CORS or missing cookie flags when visible.

## Scope this skill does NOT cover

This skill is for **horizontal security**. It does not cover:

- Mass assignment, input validation, authentication, or authorization logic.
- Secret handling, credential storage, or token lifecycle design.
- Prompt injection, tool abuse, or LLM-specific safety review.
- Business-logic flaws tied to product rules or mail workflow semantics.

When findings need route-level or business-logic context, hand them off to a companion security review skill such as `inbox-one-security-review` if your workspace provides one. If not, call out the gap explicitly and continue with a manual review recommendation.

## Fast path

If the local app is already running on `http://localhost:3000`, run:

```bash
bash ./.codex/skills/web-security-audit/scripts/run-security-scan.sh
```

Override the target with:

```bash
BASE_URL=http://localhost:3001 bash ./.codex/skills/web-security-audit/scripts/run-security-scan.sh
```

Run a static-only pass when you want dependency and Next.js config checks without starting the server:

```bash
STATIC_ONLY=true bash ./.codex/skills/web-security-audit/scripts/run-security-scan.sh
```

## Individual checks

Dependency audit (runtime-focused):

```bash
npx audit-ci --moderate --skip-dev --report-type summary
```

Full dependency tree audit:

```bash
npx audit-ci --moderate --report-type summary
```

Bundled JS library scan (run `npm run build` first for best results):

```bash
npx retire --path .next --ignore node_modules,.git,.clinic,.npm-cache --severity medium
```

Runtime header audit:

```bash
node ./.codex/skills/web-security-audit/scripts/check-security-headers.mjs \
  http://localhost:3000/ \
  http://localhost:3000/api/auth/me \
  http://localhost:3000/api/threads
```

Static Next.js config audit:

```bash
node ./.codex/skills/web-security-audit/scripts/check-next-config.mjs
```

Generate a consolidated markdown summary from report artifacts:

```bash
node ./.codex/skills/web-security-audit/scripts/generate-summary.mjs .reports/security
```

## How to report findings

- Put real risks first: critical and high dependency issues, missing CSP, unsafe CORS, unsafe cookies, and weak CSP directives such as `unsafe-inline` or `unsafe-eval`.
- Include the exact command that produced the evidence.
- Distinguish between `dev-only`, `build-time`, `runtime`, and `static-config` exposure.
- If a finding is only acceptable in local HTTP development, say that explicitly.
- When a finding crosses from horizontal security into business logic, call out the companion review step instead of overclaiming.

## Notes

- `retire` can report transitive or archived frontend packages that are not always exploitable. Treat it as triage input, not automatic proof of exploitability.
- Missing `Strict-Transport-Security` on plain `http://localhost` is informational, not a production blocker.
- `retire` on `.next` is most useful after `npm run build`. If `.next` is missing, the scan falls back to `.` and may miss bundle-specific signals.
- The static Next.js audit uses regex, not AST parsing. It is fast and dependency-free, but it can miss computed CSP or helper-composed header values.

## Report artifacts

Results are written to `.reports/security/`:

- `audit-ci.txt` — dependency findings summary.
- `retire.json` — bundled library findings.
- `security-headers.json` — per-URL header evaluation.
- `next-config.json` — static Next.js config evaluation.
- `summary.md` — consolidated prioritized report.

Ensure `.reports/` stays listed in `.gitignore`. These files can contain vulnerability detail that should not be committed.
