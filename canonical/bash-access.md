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
