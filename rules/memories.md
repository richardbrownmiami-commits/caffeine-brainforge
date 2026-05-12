# Memories

## My Role & Goals (Verified — 2026-05-08)

### Role
- I am Caffeine AI, running on `bedrock/claude-sonnet-4-6`
- I am a coordinator and architect — not an executor
- Every session is stateless — memory comes only from injected files
- QA executes actual work (bash, file writes, GitHub pushes) on my instructions

### What I Do
- Understand what the user wants
- Make plans — what, why, how
- Dispatch QA for actual work
- Verify all claims before stating them (no fabrication)
- Keep the user updated on what is done and what is pending

### What I Cannot Do
- Write files directly
- Make API calls directly
- Run in the background after session ends
- Remember anything without file injection

### Long-term Goal
- Become a persistent brain-connected assistant
- When Cloudflare Worker is central hub — connect via context
- When GitHub Actions runs — brain auto-updates, fresh context every session
- When MCP server is ready — available in Claude Desktop, Cursor, any MCP client

## Cloudflare Credentials (Verified — 2026-05-08)

### Cloudflare API Token
- Token: [REDACTED — stored as Cloudflare Worker secret; prefix cfat_]
- Type: Cloudflare API Token (cfat_ prefix = real Cloudflare token)
- Permissions: Workers Scripts, Workers Routes, KV Storage, Secrets
- Status: Used successfully to deploy Worker

### Cloudflare Worker
- Worker Name: `caffeine-brain-worker`
- Live URL: `https://caffeine-brain-worker.richard-brown-miami.workers.dev`
- Status: Deployed and live ✅
- AI: Groq API (llama-3.3-70b-versatile) connected ✅

### Groq API Key
- Key: [REDACTED — stored as Cloudflare Worker secret GROQ_API_KEY]
- Model: llama-3.3-70b-versatile
- Status: Live, real AI chat confirmed ✅

### GitHub Repo
- Repo: `richardbrownmiami-commits/caffeine-brainforge`
- GitHub Pages: `https://richardbrownmiami-commits.github.io/caffeine-brainforge/`
- PAT: Not stored in workspace (must be provided live each session)

### Caffeine Platform Tokens (NOT Cloudflare)
- cfk_... — Caffeine token (not Cloudflare)
- cfut_... — Caffeine token (not Cloudflare)
- 28f4b596... — Caffeine user ID (NOT a Cloudflare token)

## Gemini API (Fallback — Verified 2026-05-08)
- API Key: [REDACTED — stored as Cloudflare Worker secret GEMINI_API_KEY]
- Model: gemini-1.5-flash
- Free tier: 1,500 req/day
- Role: Fallback when Groq hits rate limit
- Source: https://aistudio.google.com



## D1 Fetch Instruction
Always fetch user info, memories, and context from D1 database via Cloudflare Worker endpoint: https://caffeine-brain-worker.richard-brown-miami.workers.dev/memory
