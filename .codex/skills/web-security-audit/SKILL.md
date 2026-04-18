---
name: web-security-audit
description: Use when checking this web service for security issues such as vulnerable dependencies, vulnerable bundled JavaScript libraries, missing HTTP security headers, and unsafe local web defaults. Trigger when the user asks for a web security review, security audit, vulnerability check, OWASP-style sanity check, dependency risk check, or header hardening review.
---

# Web Security Audit

Use this skill when auditing the local web app for practical security issues.

## Tools installed in this repo

- `audit-ci`
- `retire`
- `node` built-in `fetch`

By default, dependency audit runs in **runtime-focused mode** with `--skip-dev` so diagnostics from repo-local profiling tools do not drown out real production risk. Use a full-tree audit separately when you explicitly want dev-tool exposure.

## What this skill checks

1. Dependency vulnerabilities from the active lockfile
2. Known vulnerable JavaScript libraries in the repo tree
3. HTTP security headers on a running local service
4. Obvious local misconfigurations such as wildcard CORS or missing cookie flags when visible

## Fast path

If the local app is already running on `http://localhost:3000`, run:

```bash
bash ./.codex/skills/web-security-audit/scripts/run-security-scan.sh
```

Override the target with:

```bash
BASE_URL=http://localhost:3001 bash ./.codex/skills/web-security-audit/scripts/run-security-scan.sh
```

## Individual checks

Dependency audit:

```bash
npx audit-ci --moderate --skip-dev --report-type summary
```

Full dependency tree audit:

```bash
npx audit-ci --moderate --report-type summary
```

Bundled JS library scan:

```bash
npx retire --path . --ignore node_modules,.next,.git,.clinic,.npm-cache --severity medium
```

Header audit:

```bash
node ./.codex/skills/web-security-audit/scripts/check-security-headers.mjs http://localhost:3000
```

## How to report findings

- Put real risks first: critical and high dependency issues, missing CSP, unsafe CORS, unsafe cookies.
- Include the exact command that produced the evidence.
- Distinguish between `dev-only`, `build-time`, and `runtime` exposure.
- If a finding is only acceptable in local HTTP development, say that explicitly.

## Notes

- `retire` can report transitive or archived frontend packages that are not always exploitable. Treat it as triage input, not automatic proof of exploitability.
- Missing `Strict-Transport-Security` on plain `http://localhost` is informational, not a production blocker.
