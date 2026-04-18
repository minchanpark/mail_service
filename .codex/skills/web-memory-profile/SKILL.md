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
2. Run `next start` under `clinic heapprofiler`.
3. Reproduce memory pressure with `autocannon`.
4. Inspect retained objects and then reduce payload size, cache size, or duplicated parsing.

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
node ./node_modules/next/dist/bin/next start
```

## Quick commands

Heap profile under load:

```bash
npx clinic heapprofiler --open=false --autocannon [ -c 10 -d 15 'http://localhost:$PORT/api/threads?kind=all&page=1&pageSize=10' ] -- node ./node_modules/next/dist/bin/next start
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
