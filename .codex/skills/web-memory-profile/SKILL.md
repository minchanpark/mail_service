---
name: web-memory-profile
description: Use when checking or reducing this service's memory usage, heap growth, possible leaks, oversized payload retention, or Node server memory pressure. Trigger when the user asks about memory profiling, heap issues, OOM crashes, leak hunting, high RSS/heap usage, or memory optimization in the running web service.
---

# Web Memory Profile

Use this skill to reproduce and inspect memory pressure in the running service.

## Tools installed in this repo

- `clinic`
- `autocannon`
- `node`

## Primary workflow

1. Build the app.
2. Run `next start` under Node `--heap-prof` on a separate port.
3. Reproduce memory pressure with `autocannon`.
4. Inspect the generated `.heapprofile` file, then reduce payload size, cache size, or duplicated parsing.
5. Use `clinic heapprofiler` only as an optional secondary tool when richer visual output is needed.

## Fast path

Build first:

```bash
npm run build
```

Then run:

```bash
bash ./.codex/skills/web-memory-profile/scripts/run-heap-profile.sh
```

Override the target route:

```bash
TARGET_URL='http://localhost:$PORT/api/threads?kind=all&page=8&pageSize=10' bash ./.codex/skills/web-memory-profile/scripts/run-heap-profile.sh
```

The script profiles this repo with:

```bash
node --heap-prof ./node_modules/next/dist/bin/next start
```

## Quick commands

Heap profile under load with the reliable Node fallback:

```bash
PORT=3200 bash ./.codex/skills/web-memory-profile/scripts/run-heap-profile.sh
```

Optional Clinic run:

```bash
USE_CLINIC=true PORT=3200 bash ./.codex/skills/web-memory-profile/scripts/run-heap-profile.sh
```

## Typical memory problems in this repo

- Parsing a very large `data/mail-service-db.json` repeatedly
- Persisting huge `bodyHtml` payloads into the file-backed store
- Returning or storing much more mail body content than the UI actually needs
- Triggering remote backfill in a way that materializes too much data at once

## Typical fixes

- Compact stored thread payloads before persistence
- Cap stored body text and avoid storing full HTML blobs locally
- Avoid repeated full-file parse/write cycles on hot paths when possible
- Backfill remote mail in bounded batches instead of loading entire mailboxes at once
