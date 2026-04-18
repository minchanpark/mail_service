#!/usr/bin/env bash
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
REPORT_DIR="${REPORT_DIR:-.reports/security}"
RETIRE_PATH="${RETIRE_PATH:-.next}"
STATUS=0
AUDIT_SKIP_DEV="${AUDIT_SKIP_DEV:-true}"
STATIC_ONLY="${STATIC_ONLY:-false}"

record_status() {
  local code="$1"

  if [[ "$code" -eq 2 ]]; then
    STATUS=2
    return
  fi

  if [[ "$code" -ne 0 && "$STATUS" -lt 2 ]]; then
    STATUS=1
  fi
}

mkdir -p "$REPORT_DIR"
rm -f \
  "$REPORT_DIR/audit-ci.txt" \
  "$REPORT_DIR/retire.json" \
  "$REPORT_DIR/security-headers.json" \
  "$REPORT_DIR/next-config.json" \
  "$REPORT_DIR/summary.md"

if [[ ! -d "$RETIRE_PATH" ]]; then
  echo "[security] RETIRE_PATH '$RETIRE_PATH' not found. Run 'npm run build' first for the most meaningful scan. Falling back to '.'." >&2
  RETIRE_PATH="."
fi

echo "[security] audit-ci"
AUDIT_ARGS=(--moderate --report-type summary --output-format text)
if [[ "$AUDIT_SKIP_DEV" == "true" ]]; then
  AUDIT_ARGS+=(--skip-dev)
fi
npx audit-ci "${AUDIT_ARGS[@]}" | tee "$REPORT_DIR/audit-ci.txt"
record_status "${PIPESTATUS[0]}"

echo "[security] retire"
npx retire \
  --path "$RETIRE_PATH" \
  --ignore node_modules,.git,.clinic,.npm-cache \
  --severity medium \
  --outputformat json \
  --outputpath "$REPORT_DIR/retire.json"
record_status "$?"

echo "[security] next config static audit"
node ./.codex/skills/web-security-audit/scripts/check-next-config.mjs \
  | tee "$REPORT_DIR/next-config.json"
record_status "${PIPESTATUS[0]}"

trimmed_base_url="${BASE_URL%/}"

if [[ "$STATIC_ONLY" != "true" ]]; then
  echo "[security] headers (runtime, multi-path)"
  HEADER_TARGETS=(
    "$trimmed_base_url/"
    "$trimmed_base_url/api/auth/me"
    "$trimmed_base_url/api/threads"
  )
  node ./.codex/skills/web-security-audit/scripts/check-security-headers.mjs \
    "${HEADER_TARGETS[@]}" \
    | tee "$REPORT_DIR/security-headers.json"
  record_status "${PIPESTATUS[0]}"
else
  echo "[security] STATIC_ONLY=true, skipping runtime header check"
fi

echo "[security] generating summary report"
node ./.codex/skills/web-security-audit/scripts/generate-summary.mjs "$REPORT_DIR" \
  > "$REPORT_DIR/summary.md"
record_status "$?"

echo "[security] done. See $REPORT_DIR/summary.md for a consolidated view."
exit "$STATUS"
