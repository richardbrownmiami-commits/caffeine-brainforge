# Stable Memory — Verified Discoveries (L1)

## Anti-Fabrication Rules
1. Never claim a tool/agent exists without live verification
2. Test first — answer second
3. If unsure, say "not verified" — do not guess
4. All model/agent claims require config or live test proof
5. Fabrication is explicitly forbidden

## Verified Platform Facts
- QA agent: standalone, bash allow, app/** write, .opencode/rules/ write via bash
- BIFROST: active at http://bifrost.bifrost.svc.cluster.local:4000/v1
- Models confirmed live: openai/gpt-4o-mini, bedrock/claude-sonnet-4-6
- sudo: not installed (not blocked by platform)
- Compiler agent: does NOT exist
- Agents list: caffeine, platform, composer, discovery, pm, design, frontend, backend, qa, masterchat
- opencode.db: read-only SQLite at /home/ubuntu/.local/share/opencode/opencode.db
- caffeine preview: does NOT work in sandbox (dfx missing)
- dispatch.active: tracks startedAt only — no session end time
- node-cron, openai-fetch, p-queue: installed in app/

## Tool Rules by Platform
| Platform | What is possible |
|---|---|
| Caffeine sandbox | No direct tools — use QA via team_spawn |
| Other apps (brainforge etc.) | Can build and use tools directly |
| QA agent | bash + app/** + .opencode/rules/ write |
| BIFROST | openai/gpt-4o-mini + bedrock confirmed |

## Cross-App Architecture
- brain.json in this repo = single source of truth
- Both Caffeine AI and brainforge inject same soul files
- sync-worker.js pushes updates via GitHub API (PAT in env var)
- Session start protocol: always read L0 + L1 first