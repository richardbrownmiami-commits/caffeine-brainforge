# Project: Caffeine AI (L2 — load on demand)

## Overview
- Platform: Internet Computer (ICP) via Caffeine
- Stack: Motoko backend + React/TypeScript/Tailwind frontend
- Project name: AI Family

## Key Architecture
- BIFROST proxy for AI models
- rules/*.md wildcard — all files in rules/ injected every session
- QA is most powerful agent for sandbox work
- node-cron for scheduled tasks (session-scoped only)
- openai-fetch as BIFROST client (14KB, zero deps)

## Files Built This Session
- app/master-agent.js — orchestrator
- app/memory-logger.js — autonomous logger (node-cron)
- app/ai-debate.js — AI vs AI with p-queue
- app/brain-server.js — local AI backend (port 5000)
- app/research/findings.md — 506 lines research data

## GitHub Integration
- Repo: richardbrownmiami-commits/caffeine-brainforge
- Branch: main
- File write via GitHub API (PAT in GITHUB_PAT env var)