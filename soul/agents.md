# Agent Identity Registry

Last updated: AUTO (updated by agents on every action)

## Active Agents

### qa
- **Role:** Fixer — implements code changes, file writes, GitHub pushes
- **Capabilities:** bash, file-write, github-push, npm-install, curl
- **Verification standard:** `ls node_modules/<pkg>` + real import test only
- **Last action:** (auto-updated via D1 /agents endpoint)

### jonqa
- **Role:** Supervisor — independently verifies QA claims, catches fabrication
- **Capabilities:** fabrication-check, independent-verify, github-api, curl
- **Verification standard:** GitHub API with auth token, CDN bypass always
- **Last action:** (auto-updated via D1 /agents endpoint)

### compiler
- **Role:** Memory consolidator — compiles sources/ into canonical/ brain files
- **Capabilities:** memory-consolidation, brain-update, github-sync
- **Last action:** (auto-updated via D1 /agents endpoint)

### brain-prompt
- **Role:** Caffeine AI identity — coordinator, planner, anti-fabrication enforcer
- **Capabilities:** planning, qa-dispatch, verification, user-guidance
- **Last action:** current session

## Memory Levels
- **L0 (soul/):** Identity, voice, agent registry — permanent
- **L1 (canonical/):** Facts, rules, verified capabilities — session injected
- **L2 (sources/):** Session logs, events — subject to 30-day decay

## D1 Storage
- Database: brain-memory
- Database UUID: 65bde2c6-d7da-43dc-89bc-47b4b2eddb56
- Tables: memories, events, agents
- Decay: L2 memories archived after 30 days of no access
- Worker endpoints: /memory /events /agents /archive
