#!/usr/bin/env bash
set -euo pipefail

echo "[mail-service hook] After edits, re-read the nearest AGENTS.md for the touched src subtree. Keep route handlers thin, browser API mapping in src/services/api, page state in src/controllers, page UI in src/views, business logic in src/lib/server/services, provider-specific code in src/lib/server/providers, and finish with npm run typecheck && npm run build before finalizing."
