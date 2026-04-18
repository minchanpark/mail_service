#!/usr/bin/env bash
set -euo pipefail

REPORT_DIR="${REPORT_DIR:-.reports/clinic}"
PROFILE_NAME="${PROFILE_NAME:-mail-service-heap}"
DEFAULT_TARGET_URL='http://localhost:$PORT/api/threads?kind=all&page=1&pageSize=10'
TARGET_URL="${TARGET_URL:-$DEFAULT_TARGET_URL}"
CONNECTIONS="${CONNECTIONS:-10}"
DURATION="${DURATION:-15}"

mkdir -p "$REPORT_DIR"

echo "[memory] profiling target=$TARGET_URL connections=$CONNECTIONS duration=${DURATION}s"
npx clinic heapprofiler \
  --open=false \
  --dest "$REPORT_DIR" \
  --name "$PROFILE_NAME" \
  --autocannon [ -c "$CONNECTIONS" -d "$DURATION" "$TARGET_URL" ] \
  -- node ./node_modules/next/dist/bin/next start
