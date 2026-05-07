# caffeine-brain v2.0

**Autonomous AI brain with persistent memory, API handshake, and cross-app sync.**

Inspired by: `agent-soul` (3-level loading), `iranti` (handshake protocol), `multi-agent-memory` (cross-agent brain).

## Architecture

```
soul/           ← L0: Identity (always load, ~100 lines)
canonical/      ← L1: Stable memory + L2: On-demand context
sources/        ← Append-only event streams (write here)
api/            ← handshake.js + sync-worker.js
agents/         ← compiler.js + memory-logger.js
```

## 3-Level Loading Protocol

| Level | Files | When |
|---|---|---|
| L0 Soul | soul/SOUL.md + IDENTITY.md + VOICE.md | Always, every turn |
| L1 Memory | canonical/profile.md + stable-memory.md | Session start |
| L2 Context | canonical/projects/*.md | On-demand only |

Default context: ~4K tokens. Never load everything.

## API

- `GET /health` — server status
- `GET /handshake` — get full brain system prompt (L0 + L1)

## Sync

```bash
GITHUB_PAT=your_token node api/sync-worker.js
```

## Autonomous Logger

```bash
node agents/memory-logger.js
```

Logs discoveries every 10 minutes to `sources/caffeine/YYYY-MM-DD.md`.

## Compiler

```bash
node agents/compiler.js
```

Merges `sources/` events into `canonical/fuzzy-memory.md`.
