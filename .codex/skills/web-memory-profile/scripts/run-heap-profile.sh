#!/usr/bin/env bash
set -euo pipefail

REPORT_DIR="${REPORT_DIR:-.reports/memory}"
PROFILE_NAME="${PROFILE_NAME:-mail-service-heap}"
PORT="${PORT:-3200}"
DEFAULT_TARGET_URL='http://localhost:$PORT/api/threads?kind=all&page=1&pageSize=10'
TARGET_URL="${TARGET_URL:-$DEFAULT_TARGET_URL}"
CONNECTIONS="${CONNECTIONS:-10}"
DURATION="${DURATION:-15}"
USE_CLINIC="${USE_CLINIC:-false}"

mkdir -p "$REPORT_DIR"

TARGET_URL="${TARGET_URL//\$PORT/$PORT}"

wait_for_server() {
  local attempts=0
  until curl -fsS "http://localhost:${PORT}/" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [[ "$attempts" -ge 60 ]]; then
      return 1
    fi
    sleep 1
  done
}

if [[ "$USE_CLINIC" == "true" ]]; then
  echo "[memory] clinic target=$TARGET_URL connections=$CONNECTIONS duration=${DURATION}s"
  PORT="$PORT" npx clinic heapprofiler \
    --open=false \
    --collect-only \
    --dest "$REPORT_DIR" \
    --name "$PROFILE_NAME" \
    --stop-delay 1000 \
    --autocannon "[ -c $CONNECTIONS -d $DURATION $TARGET_URL ]" \
    -- node ./node_modules/next/dist/bin/next start
  exit 0
fi

LOG_PATH="$REPORT_DIR/${PROFILE_NAME}.server.log"
AUTOCANNON_PATH="$REPORT_DIR/${PROFILE_NAME}.autocannon.txt"
HEAPPROFILE_PATH="$REPORT_DIR/${PROFILE_NAME}.heapprofile"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill -INT "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" || true
  fi
}

trap cleanup EXIT

echo "[memory] node-heap-prof target=$TARGET_URL connections=$CONNECTIONS duration=${DURATION}s port=$PORT"
PORT="$PORT" node \
  --heap-prof \
  --heap-prof-dir="$REPORT_DIR" \
  --heap-prof-name="${PROFILE_NAME}.heapprofile" \
  ./node_modules/next/dist/bin/next start >"$LOG_PATH" 2>&1 &
SERVER_PID=$!

wait_for_server

npx autocannon \
  -c "$CONNECTIONS" \
  -d "$DURATION" \
  --renderStatusCodes \
  "$TARGET_URL" | tee "$AUTOCANNON_PATH"

cleanup
trap - EXIT

if [[ -f "$HEAPPROFILE_PATH" ]]; then
  echo "[memory] heap profile written to $HEAPPROFILE_PATH"
else
  echo "[memory] expected heap profile was not created" >&2
  exit 1
fi
