---
name: web-network-performance
description: Use when checking or improving this service's network performance, request latency, throughput, error rate, and hot endpoint behavior. Trigger when the user asks for load testing, API latency checks, throughput measurement, slow endpoint diagnosis, TTFB review, or backend/network performance improvement for the running service.
---

# Web Network Performance

Use this skill to measure request latency and throughput on the running service.

## Tools installed in this repo

- `autocannon`
- `curl`

## Primary workflow

1. Start the app locally.
2. Benchmark the slow or critical route with `autocannon`.
3. Compare p50/p95/p99 latency, requests/sec, and error rate.
4. If latency is bad, inspect the route handler and downstream service path.

## Fast path

Default target:

```bash
bash ./.codex/skills/web-network-performance/scripts/run-autocannon.sh
```

Override target or pressure:

```bash
TARGET_URL='http://localhost:3000/api/threads?kind=all&page=1&pageSize=10' CONNECTIONS=30 DURATION=20 bash ./.codex/skills/web-network-performance/scripts/run-autocannon.sh
```

## Quick commands

Header timing:

```bash
curl -w 'dns=%{time_namelookup} connect=%{time_connect} ttfb=%{time_starttransfer} total=%{time_total}\n' -o /dev/null -s http://localhost:3000/api/threads?kind=all&page=1&pageSize=10
```

Load test:

```bash
npx autocannon -c 20 -d 15 --renderStatusCodes http://localhost:3000/api/threads?kind=all&page=1&pageSize=10
```

## How to interpret results

- High `requests/sec` with low p95 means the route is healthy.
- Good p50 but bad p99 usually means a blocking branch, slow storage, or repeated sync work.
- Rising non-2xx counts under load means you have backpressure or unhandled failures.
- Compare API endpoints separately from page HTML requests.

## Typical fixes

- Remove repeated expensive work from hot route handlers.
- Cache or defer remote mailbox sync triggered during listing.
- Trim oversized payloads and avoid serializing large unused fields.
- Reduce synchronous file I/O and repeated full-state parsing on every request.
