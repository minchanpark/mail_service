#!/usr/bin/env bash
set -euo pipefail

echo "[mail-service hook] After edits, re-read the nearest AGENTS.md for the touched src subtree. Keep route handlers thin, business logic in src/lib/server/services, provider-specific code in src/lib/server/providers, client fetch logic in src/lib/client, and finish with npm run typecheck && npm run build before finalizing."
