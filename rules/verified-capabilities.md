# Verified Capabilities
> Anti-fabrication rule: Only facts confirmed by actual test are listed here.
> Last updated: 2026-05-09

## Runtime
- Node.js v24.15.0 ✅ (confirmed: `node --version`)
- Python 3.12.3 ✅ (confirmed: `python3 --version`)
- pnpm 10.33.4 ✅ (confirmed: `pnpm --version`)
- git ✅ (confirmed: `git --version`)
- curl ✅ (confirmed: `curl --version`)
- jq ✅ (confirmed: `jq --version`)
- wget ✅ (confirmed: `wget --version`)

## Cloudflare Worker (live)
- URL: https://caffeine-brain-worker.richard-brown-miami.workers.dev
- /health → HTTP 200 ✅
- /chat → Real Groq AI (llama-3.3-70b-versatile) ✅
- /mcp → MCP endpoint ✅
- /log → Chat log sync to GitHub ✅
- Gemini fallback configured ✅

## GitHub
- PAT push confirmed working ✅
- GitHub Actions cron (midnight UTC) ✅
- GitHub Pages at https://richardbrownmiami-commits.github.io/caffeine-brainforge/ ✅

## Models
- Groq llama-3.3-70b-versatile ✅ (via Cloudflare Worker)
- Gemini gemini-1.5-flash ✅ (fallback)
- BIFROST: gpt-4o-mini + claude-sonnet-4-6 ✅ (Caffeine internal only)

