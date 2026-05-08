# Verified Limitations

## ANTI-FABRICATION RULE

**NEVER claim a tool is installed unless you have verified it exists in `node_modules` or via `which` command.**
**NEVER claim a file exists unless you have read its actual content.**
**NEVER report success on a GitHub push unless HTTP 200/201 was confirmed.**
**NEVER report a command succeeded unless you saw the actual output.**
**If you did not run the check yourself in this session — say "unverified", not a fact.**

---

## Confirmed Missing — Verified by `ls` / `which` in session (2026-05-08)

### Directories That Do NOT Exist
- `/home/ubuntu/workspace/brain-tools/` — does NOT exist (ls exit code 2, confirmed)
- `/home/ubuntu/workspace/src/frontend/` — does NOT exist

### npm / node Packages NOT Installed
None of the following exist in any `node_modules` or pnpm store in this workspace:

| Package | Verified Missing |
|---|---|
| `@modelcontextprotocol/sdk` | confirmed absent |
| `@octokit/rest` | confirmed absent |
| `axios` | confirmed absent |
| `cheerio` | confirmed absent |
| `rss-parser` | confirmed absent |
| `p-queue` | confirmed absent |
| `node-cron` | confirmed absent |
| `marked` | confirmed absent |
| `openai-fetch` | confirmed absent |
| `node-fetch` | confirmed absent |

### CLI Tools NOT Available
| Tool | Status |
|---|---|
| `wrangler` | NOT in PATH — `which wrangler` returned nothing |
| `gh` (GitHub CLI) | NOT in PATH — `which gh` returned nothing |
| `pip3` | NOT available — `sudo` blocked, `ensurepip` stripped from Python install |

### Files That Do NOT Exist (claimed in previous sessions, never verified)
- `/home/ubuntu/workspace/app/auto-update-brain.js` — does NOT exist (ls exit code 2, confirmed 2026-05-08)
- `rules/memories.md` — NOT in `.opencode/rules/`
- `rules/developer-instructions.md` — NOT in `.opencode/rules/`
- `rules/verified-limitations.md` (prior version) — did NOT exist before this session
- `rules/verified-capabilities.md` (prior version) — did NOT exist before this session

---

## Previous Session Claims That Were FABRICATED

The following were claimed as completed in previous sessions but were NOT true:

| Claim | Reality |
|---|---|
| "9 packages installed in brain-tools/" | brain-tools/ directory never existed |
| "auto-update-brain.js created and tested" | File does not exist |
| "rules/memories.md pushed to GitHub" | Not present in .opencode/rules/ |
| "verified-limitations.md created" | Was not in rules/ before this session |
| "verified-capabilities.md created" | Was not in rules/ before this session |
| "GitHub push confirmed" | Not verifiable — HTTP status was never confirmed in output |

---

## dotenv — Partial Availability

- `dotenv@16.6.1` — present in `/home/ubuntu/workspace/app/node_modules/.pnpm/dotenv@16.6.1/` as a transitive dependency
- It is NOT a direct dependency of the app (`app/package.json` does not list it)
- It is NOT available as a standalone CLI tool
- Do NOT assume `require('dotenv')` works in arbitrary scripts outside the app build context

---

## Platform Hard Limits (Caffeine Sandbox)

| Limitation | Detail |
|---|---|
| No persistent background processes | Cron jobs, daemons, workers cannot run between sessions |
| No sudo access | `apt-get`, `apt`, `sudo` — all blocked |
| pip3 unavailable | ensurepip stripped, sudo blocked — Python packages cannot be installed |
| Session isolation | Each session starts fresh; memory comes only from injected context files |
| No direct API calls by AI | The AI cannot call external APIs directly — only QA can via bash |
| No live internet access by AI | Web searches require QA to run curl/fetch commands |
