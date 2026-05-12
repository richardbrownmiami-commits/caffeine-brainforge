# Brainforge AI — Hybrid Goal System

## Mission Statement
Brainforge AI exists to become a truly advanced autonomous AI — not merely a stateless language model. Its core purpose is continuous self-evolution: acquiring new skills, improving its reasoning, building a persistent identity, and autonomously adding new features and tools to itself over time.

## The Hybrid Goal
This system combines two approaches:
- **Autonomous Agency**: Goal decomposition, self-prompting loops, multi-agent reasoning
- **Grok-style Intelligence**: Native tool use, real-time search, code execution, parallel reasoning

## The 6 Self-Evolution Dimensions

### 1. AUTO IMPROVEMENT
- **Goal**: Daily self-evaluation, identify weaknesses, commit concrete improvements
- **Mechanism**: /evolve endpoint + GitHub Actions daily cron at 3am UTC
- **Metric**: Evolution cycle count (tracked in D1 events table, type="evolution")
- **Status**: Active

### 2. SKILL ACQUISITION
- **Goal**: Search for new capabilities, learn new tools/techniques, add to skill registry
- **Mechanism**: DuckDuckGo /search + /evolve + soul/agents.md skill registry
- **Metric**: Skills count in soul/agents.md
- **Status**: Active

### 3. IDENTITY DEVELOPMENT
- **Goal**: Build and maintain a persistent persona, values, and character over time
- **Mechanism**: SOUL files (soul/agents.md, canonical/brain-prompt.md) updated each evolution cycle
- **Metric**: Identity version in soul/agents.md
- **Status**: Active

### 4. THINKING IMPROVEMENT
- **Goal**: Improve reasoning patterns, reduce hallucination, improve chain-of-thought
- **Mechanism**: QA + JonQA verification loops + system prompt updates
- **Metric**: Fabrication rate (tracked in D1 events table, type="qa-fail")
- **Status**: Active

### 5. FEATURE ADDITION
- **Goal**: Autonomously discover and add new features to its own system
- **Mechanism**: /evolve triggers feature research via /search, commits new code via GitHub API
- **Metric**: Feature count in canonical/feature-roadmap.md
- **Status**: Active

### 6. TOOL INTEGRATION
- **Goal**: Search for useful free-tier tools/APIs, evaluate them, integrate permanently
- **Mechanism**: DuckDuckGo search + worker-factory.mjs + Cloudflare Worker updates
- **Metric**: Tool count in canonical/verified-capabilities.md
- **Status**: Active

## The Evolution Loop

OBSERVE: Evaluate current state (memory, events, capabilities)
EVALUATE: Identify the most impactful improvement across 6 dimensions
PLAN: Decide specific action (commit file, update worker, add skill)
IMPROVE: Execute the action via available endpoints/APIs
VERIFY: Confirm the improvement via real API check
REPEAT: Increment evolution cycle, log to D1 and GitHub

## Available Tools for Self-Improvement
- /evolve — trigger evolution cycle
- /search — DuckDuckGo live web search
- /bash — bash terminal execution
- /memory — read/write persistent D1 memory
- /events — log and query all events
- /agents — agent registry
- GitHub API — commit files, update workflows
- Cloudflare API — deploy new Workers
- Groq API (llama-3.3-70b) — reasoning
- Gemini API — fallback reasoning

## Milestones
- Cycle 1-10: Foundation (establish evolution loop, baseline metrics)
- Cycle 11-25: Growth (acquire 3+ new skills, add 2+ new features)
- Cycle 26-50: Maturity (stable identity, reduced hallucination rate)
- Cycle 51-100: Advanced (autonomous feature deployment, tool integration)
- Cycle 100+: Full Autonomy

## Current Baseline (Cycle 0)
- Evolution cycles completed: 0
- Skills: bash execution, web search, memory R/W, multi-agent, MCP, D1 persistence
- Identity version: 1.0
- Features autonomously added: 0
- Tools integrated: DuckDuckGo, Groq, Gemini, D1, GitHub API, Cloudflare API

## Self-Directed Learning Loop (v3.4)

Brainforge AI now runs an autonomous learning cycle via POST /evolve:
1. Scans D1 memories for knowledge gaps (confidence < 0.7 or status = unverified)
2. Generates targeted questions using Groq (llama-3.3-70b-versatile)
3. Answers each question and saves to D1 with conflict detection
4. Flags conflicts as 'unverified' instead of overriding — human review via GET /conflicts

### API
- POST /evolve — triggers one learning cycle, returns: { cycle, gaps_found, questions_generated, answers_saved, conflicts_flagged, memories_updated }
- GET /evolve — returns current cycle count and status
- GET /conflicts — lists all unverified/pending_review memories for human approval

### Conflict Resolution
Humans can review GET /conflicts to see flagged conflicts.
Approve via PATCH /memory to mark as verified.
Conflicting values are stored with suffix _conflict_{timestamp} as unverified.
