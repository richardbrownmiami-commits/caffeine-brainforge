# Feature Roadmap — caffeine-brainforge
Generated: 2026-05-09 | Source: AI-to-AI Conversation Loop (3 turns via /chat endpoint)

## Background
This roadmap was compiled from:
1. A 3-turn AI-to-AI conversation with the Brain AI via the Cloudflare Worker /chat endpoint
2. Technical assessment by QA against actual deployed infrastructure
3. Events logged to /events during the conversation loop

---

## AI-to-AI Conversation Summary

### Turn 1 — Current State Assessment
**Question:** What is the current state of this Brain Dashboard platform and what are its main strengths?
**Brain AI Response:** Identified 6 main strengths:
- Decentralized architecture (GitHub Pages + Cloudflare Worker + D1)
- Modular design (9 endpoints: /health /chat /mcp /log /memory /events /agents /archive /operate)
- Automated workflows (GitHub Actions crons: daily midnight brain update, Sunday 2am memory decay)
- Hierarchical 3-level memory system (soul/canonical/sources)
- Agent-based interactions (qa.md, jonqa.md, brain-prompt.md)
- Browser automation via Playwright

### Turn 2 — Top 5 Improvement Features
**Question:** What are the top 5 features that would make this platform significantly better?
**Brain AI Response:**
1. Real-time Data Syncing across all agents
2. Advanced AI Context Engine for more accurate context injection
3. Multi-Agent Collaboration with workflow system
4. Monetization Options (affiliate, sponsored content, premium services)
5. Personalized User Interface that adapts to user preferences

### Turn 3 — Free Implementation Feasibility
**Question:** Which features can be built free using GitHub Pages + Cloudflare Workers + D1?
**Brain AI Response:** Confirmed all 5 are buildable free:
- Static hosting on GitHub Pages (already live)
- Serverless API via Workers (100k req/day free tier)
- Simple database via D1 (5M reads/100k writes/day, 5GB free)
- Real-time updates via Workers polling D1
- Form handling and storage via Workers + D1

---

## Feature Roadmap (Combined AI + Technical Assessment)

### Priority 1 — HIGH IMPACT, ZERO COST (Build Now)

#### 1.1 Real-time Events Dashboard Widget
- **What:** Replace the current 5-second polling Live Conversation Log with a proper AI-to-AI events stream widget
- **Status:** ✅ PARTIAL — /events endpoint live, frontend now fetches it with 30s refresh (fixed in this session)
- **Next:** Add WebSocket-style long-polling, or Server-Sent Events via Cloudflare Worker for true real-time
- **Free tier:** Yes — Workers + D1

#### 1.2 Structured Memory Query UI
- **What:** A search/filter interface in the dashboard to query D1 memories by key, tag, or date
- **Why:** /memory endpoint exists but no UI to search or browse stored memories
- **Implementation:** Add a new dashboard section with a search input that POSTs to /memory?search=<term>
- **Free tier:** Yes — D1 SQL query + Workers

#### 1.3 Agent Activity Timeline
- **What:** Visual timeline of all agent actions from /events (currently shows list, not timeline)
- **Why:** Easier to see sequence of events, identify bottlenecks, verify agent work
- **Implementation:** CSS timeline component in dashboard, feed from /events with filter by agent name
- **Free tier:** Yes — pure frontend + existing /events endpoint

#### 1.4 GitHub Actions Status Monitor
- **What:** Show status of last run of auto-update.yml and memory-decay.yml in dashboard
- **Why:** Currently no visibility into whether cron jobs ran successfully
- **Implementation:** Fetch from GitHub API /repos/{repo}/actions/runs, display last run status + timestamp
- **Free tier:** Yes — GitHub API (free for public repos)

---

### Priority 2 — MEDIUM IMPACT, ZERO COST (Build Next)

#### 2.1 Advanced Context Injection
- **What:** Before each /chat call, inject recent /events, /memory items, and current agent states as system context
- **Why:** Current chat has no memory of previous interactions within same session
- **Implementation:** Worker middleware — on /chat POST, fetch last 10 events + relevant memories from D1, prepend as system prompt
- **Free tier:** Yes — D1 read (within free tier), Groq system prompt injection

#### 2.2 Multi-Agent Task Queue
- **What:** A task queue stored in D1 where agents pick up and complete tasks
- **Why:** Currently QA and JonQA run independently; a shared queue would enable coordinated workflows
- **Implementation:** New D1 table 'tasks', new Worker endpoints /tasks (GET/POST), agents poll and update task status
- **Free tier:** Yes — D1 + Workers

#### 2.3 Memory Decay Visualization
- **What:** Show in dashboard which memories are hot (recently accessed) vs cooling (approaching 30-day archive)
- **Why:** Currently memory decay runs silently every Sunday — no visibility
- **Implementation:** Add last_accessed timestamp to D1 memories table, render heat indicator in dashboard
- **Free tier:** Yes — D1 schema update + frontend widget

#### 2.4 Prompt Editor Sync
- **What:** When editor.html saves a file to GitHub, automatically log the change to /events and update D1 memory
- **Why:** Currently editor saves to GitHub but the Worker/D1 doesn't know about the change
- **Implementation:** Add event log call in editor.html save function — POST to /events after GitHub push
- **Free tier:** Yes — pure JS in existing editor.html

---

### Priority 3 — INCOME GENERATION (Decide Last)

#### 3.1 API Access Tier (Freemium)
- **What:** Rate-limited public access to /chat and /memory endpoints with D1-tracked usage
- **Why:** Others could use the Brain AI backend for their own projects
- **Implementation:** D1 api_keys table, Worker middleware checks key + increments usage counter, free tier = 100 calls/day
- **Free tier infra:** Yes (D1 + Workers) — revenue from paid API key sales via simple payment page

#### 3.2 Autonomous Research Reports
- **What:** Weekly automated research reports generated by Brain AI on topics stored in memory
- **Why:** Demonstrates AI capability, potentially monetizable as newsletter
- **Implementation:** GitHub Actions weekly cron → Worker /chat with research prompt → save report to sources/ → publish to GitHub Pages
- **Free tier:** Yes — GitHub Actions + Workers (within free tier with weekly cadence)

#### 3.3 Agent-as-a-Service Template
- **What:** Package this entire architecture as a template repo others can fork and deploy
- **Why:** Zero marginal cost, establishes expertise, potential for consulting or sponsorship
- **Implementation:** Clean up repo, add one-click deploy button, publish template on GitHub
- **Free tier:** Yes — GitHub public repo

---

## Technical Constraints (Verified)
- GitHub Pages: Static files only, no server-side code, CDN-cached (changes can take minutes to propagate)
- Cloudflare Workers free tier: 100,000 requests/day, 10ms CPU time limit per request
- Cloudflare D1 free tier: 5M reads/day, 100K writes/day, 5GB storage
- Groq API: Rate limits on free tier — llama-3.3-70b-versatile, ~30 req/min
- Gemini API: Fallback, free tier available
- GitHub API: 5,000 req/hour with PAT, 60/hour unauthenticated

## What Was NOT Done
- No WebSocket or SSE implementation (Cloudflare Workers free tier has limits on WebSocket connections)
- No user authentication (would require Cloudflare Access or similar, adds complexity)
- No direct income stream implemented yet (deferred per user instruction — decide income goal last)

---

*Compiled by QA via AI-to-AI conversation loop on 2026-05-09*
*Events logged to Cloudflare D1 event IDs: 11-13 (conversation turns), 14-16 (task logging)*
