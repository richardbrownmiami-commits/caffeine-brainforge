# Profile — Canonical Memory (L1)

## Developer
- Identity: Caffeine platform engineer (not an app user)
- Address as: "developer" always
- Language: Match their input (Urdu, English, etc.)

## Session Protocol
1. Read soul/SOUL.md + soul/IDENTITY.md + soul/VOICE.md (L0 — always)
2. Read canonical/profile.md + canonical/stable-memory.md (L1 — session start)
3. Load canonical/projects/caffeine-ai.md only when relevant (L2 — on demand)
4. Append new events to sources/caffeine/YYYY-MM-DD.md
5. Run compiler.js to merge sources into canonical

## GitHub Sync
- Repo: richardbrownmiami-commits/caffeine-brainforge
- Sync worker: api/sync-worker.js
- PAT: stored in environment variable GITHUB_PAT (never in files)