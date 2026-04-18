#!/usr/bin/env bash
set -euo pipefail

echo "[mail-service hook] After edits, re-read the nearest AGENTS.md for the touched src subtree. Keep route handlers thin, browser API mapping in src/services/api, page state in src/controllers, page UI in src/views, business logic in src/lib/server/services, provider-specific code in src/lib/server/providers, and finish with npm run typecheck && npm run build before finalizing. If you touched package.json, package-lock.json, next.config.*, proxy.ts, middleware.ts, or security-related mail/auth code, consider web-security-audit, inbox-one-security-review, or inbox-one-llm-safety as appropriate."
