# Structured Event Log Schema

All events stored in D1 `events` table AND available via Worker `/events` endpoint.

## Schema
```json
{
  "ts": "ISO8601 timestamp",
  "agent": "qa | jonqa | compiler | brain-prompt | cron | chat | mcp | memory",
  "action": "fix | verify | deploy | archive | chat | research | write | read",
  "result": "pass | fail | fallback | partial | success | logged",
  "tags": ["array", "of", "strings"],
  "detail": "short description max 200 chars"
}
```

## Storage Locations
- **Primary:** D1 database `brain-memory` → `events` table (fast query)
- **Query:** `GET /events?agent=qa&limit=20` via Worker

## Rules
- Every agent action MUST log an event
- D1 is primary storage — all worker endpoints auto-log
- Events are queryable via Worker `/events?agent=<name>&limit=<n>`
- Agents update their registry via `POST /agents` with `{name, action}`

## Example Queries
```bash
# Last 20 events
curl https://caffeine-brain-worker.richard-brown-miami.workers.dev/events

# Filter by agent
curl "https://caffeine-brain-worker.richard-brown-miami.workers.dev/events?agent=chat&limit=10"

# Get all agents status
curl https://caffeine-brain-worker.richard-brown-miami.workers.dev/agents
```
