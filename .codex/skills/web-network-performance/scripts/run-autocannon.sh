#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${TARGET_URL:-http://localhost:3000/api/threads?kind=all&page=1&pageSize=10}"
CONNECTIONS="${CONNECTIONS:-20}"
DURATION="${DURATION:-15}"
REPORT_DIR="${REPORT_DIR:-.reports/network}"

mkdir -p "$REPORT_DIR"

echo "[network] target=$TARGET_URL connections=$CONNECTIONS duration=${DURATION}s"
npx autocannon \
  -c "$CONNECTIONS" \
  -d "$DURATION" \
  --renderStatusCodes \
  "$TARGET_URL" | tee "$REPORT_DIR/autocannon.txt"
