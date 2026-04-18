#!/usr/bin/env bash
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
REPORT_DIR="${REPORT_DIR:-.reports/security}"
RETIRE_PATH="${RETIRE_PATH:-.next}"
STATUS=0

mkdir -p "$REPORT_DIR"

if [[ ! -d "$RETIRE_PATH" ]]; then
  RETIRE_PATH="."
fi

echo "[security] audit-ci"
if ! npx audit-ci --moderate --report-type summary --output-format text | tee "$REPORT_DIR/audit-ci.txt"; then
  STATUS=1
fi

echo "[security] retire"
if ! npx retire \
  --path "$RETIRE_PATH" \
  --ignore node_modules,.git,.clinic,.npm-cache \
  --severity medium \
  --outputformat json \
  --outputpath "$REPORT_DIR/retire.json"; then
  STATUS=1
fi

echo "[security] headers"
if ! node ./.codex/skills/web-security-audit/scripts/check-security-headers.mjs "$BASE_URL" | tee "$REPORT_DIR/security-headers.json"; then
  STATUS=1
fi

exit "$STATUS"
