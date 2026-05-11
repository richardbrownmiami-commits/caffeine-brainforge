# Permanent Bash Access

## Permanent URL
https://caffeine-brain-worker.richard-brown-miami.workers.dev/bash

## How It Works
The /bash endpoint on `caffeine-brain-worker` provides permanent bash terminal access.
Since the underlying tunnel URL changes each session, the endpoint stores the current
tunnel URL in Cloudflare D1 and redirects visitors there.

## Features
- **GET /bash** — Shows terminal launcher page. If a tunnel URL is stored, auto-redirects in 2s.
- **GET /bash?url=<tunnel-url>** — Redirect to a specific tunnel URL (also stores it in D1).
- **POST /bash** with `{"tunnelUrl": "..."}` — Update the stored tunnel URL in D1.

## To Reconnect After Session Reset
1. Start ttyd: `ttyd -p 7681 bash &`
2. Start tunnel: `cloudflared tunnel --url http://localhost:7681 run "agro trust tunnel"`
3. Note the new temporary URL
4. Update the permanent endpoint:
   ```
   curl -X POST https://caffeine-brain-worker.richard-brown-miami.workers.dev/bash \
     -H "Content-Type: application/json" \
     -d '{"tunnelUrl": "https://YOUR-NEW-TUNNEL-URL.trycloudflare.com"}'
   ```

## Named Tunnel
- Name: agro trust tunnel
- ID: 8690a2f0-925a-48c2-8376-d5fcd2b0f776
- Permanent URL: https://caffeine-brain-worker.richard-brown-miami.workers.dev/bash

## Deployment Info
- Worker: caffeine-brain-worker
- Deployment ID: e97f3320fba8457a9a9278b399d1545e
- D1 key: bash-tunnel-url (L1 memory — persists across sessions)
- Deployed: 2026-05-09

## Worker Endpoints Reference

### GET /memory?key=<keyname>
Fetch a specific memory from D1 database by key.
- **Required:** `key` query parameter
- **Returns:** JSON with memory value
- **Without key:** returns HTTP 400 "key parameter required"
- **Example:**
  ```
  curl "https://caffeine-brain-worker.richard-brown-miami.workers.dev/memory?key=brain-state"
  ```

### POST /memory
Store a memory in D1.
- **Body:** `{"key": "<name>", "value": "<content>"}`
- **Example:**
  ```
  curl -X POST https://caffeine-brain-worker.richard-brown-miami.workers.dev/memory \
    -H "Content-Type: application/json" \
    -d '{"key": "test", "value": "hello"}'
  ```

### GET /events
List recent agent events from D1.
- **Returns:** JSON array of event objects with id, type, agent, data, timestamp
- **Example:**
  ```
  curl "https://caffeine-brain-worker.richard-brown-miami.workers.dev/events"
  ```

### GET /agents
List registered agents from D1.
- **Returns:** JSON array of agent records
- **Example:**
  ```
  curl "https://caffeine-brain-worker.richard-brown-miami.workers.dev/agents"
  ```

### GET /health
Worker health status and endpoint manifest.
- **Returns:** JSON with version, d1 status, and endpoint list
- **Example:**
  ```
  curl "https://caffeine-brain-worker.richard-brown-miami.workers.dev/health"
  ```

### POST /chat
Send a message to Brainforge AI (Groq + Gemini fallback).
- **Body:** `{"message": "<text>"}`
- **Returns:** JSON with AI response, model used, and timestamp
- **Example:**
  ```
  curl -X POST https://caffeine-brain-worker.richard-brown-miami.workers.dev/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "What are your capabilities?"}'
  ```

### GET /evolve
Trigger a self-improvement cycle (Brainforge hybrid goal).
- **Returns:** JSON with evolution suggestion and cycle count
- **Example:**
  ```
  curl "https://caffeine-brain-worker.richard-brown-miami.workers.dev/evolve"
  ```

### GET /archive
Dry-run count of L2 memories eligible for archiving (>30 days inactive).

### POST /archive
Execute memory archiving: moves old L2 memories to archive table.
- **Example:**
  ```
  curl -X POST https://caffeine-brain-worker.richard-brown-miami.workers.dev/archive
  ```
