# AGENTS

This file applies to `.codex/skills/web-security-audit/`.

## Rules

- Keep `AUDIT_SKIP_DEV=true` as the default dependency audit mode.
- Preserve the environment override pattern: `BASE_URL`, `REPORT_DIR`, `RETIRE_PATH`, `AUDIT_SKIP_DEV`, and `STATIC_ONLY`.
- Preserve `set -uo pipefail` in shell scripts. Do not add `set -e`.
- Preserve the `exit 2` convention for medium-or-higher security findings.
- Treat missing HSTS on plain localhost HTTP as informational only.
- Keep the `retire` limitation note in `SKILL.md`: triage input, not automatic proof of exploitability.
- Prefer small dependency-free scripts. If parsing stays regex-based, document its limits in comments.
