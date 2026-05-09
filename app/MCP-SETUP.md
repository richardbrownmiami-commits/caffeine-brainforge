# MCP Setup Guide — Caffeine Brain Worker v3.0

## What is MCP?
MCP (Model Context Protocol) allows Claude Desktop or Cursor to connect directly to your Caffeine Brain Worker.
After setup, Claude can read/write memory, log events, list agents, and operate the Brain Dashboard from inside your chat.

---

## Quick Config

Paste this into your Claude Desktop config file:

```json
{
  "mcpServers": {
    "caffeine-brain": {
      "url": "https://caffeine-brain-worker.richard-brown-miami.workers.dev/mcp"
    }
  }
}
```

Config file is also available at: `app/mcp-config.json` in this repo.

---

## Step-by-Step: Claude Desktop

### Windows
1. Download Claude Desktop: https://claude.ai/download
2. Open config file: `C:\Users\YourName\AppData\Roaming\Claude\claude_desktop_config.json`
3. Paste the config JSON above (if file has existing content, merge the mcpServers key)
4. Save and restart Claude Desktop
5. Type in Claude: `List my brain agents` — you should see qa, jonqa, compiler

### Mac
1. Download Claude Desktop: https://claude.ai/download
2. Open config file: `~/Library/Application Support/Claude/claude_desktop_config.json`
3. Paste the config JSON above (merge if needed)
4. Save and restart Claude Desktop
5. Type in Claude: `List my brain agents` — you should see qa, jonqa, compiler

---

## Urdu/Hindi Guide

**MCP kya hai?**
MCP aapko Claude Desktop ko Caffeine Brain Worker se seedha connect karne deta hai.
Setup ke baad, Claude memory read/write, events log, agents list — sab chat ke andar se kar sakta hai.

**Windows mein config file:**
`C:\Users\AapKaNaam\AppData\Roaming\Claude\claude_desktop_config.json`
File nahi dikh rahi? File Explorer mein Hidden Items show karo.

**Mac mein config file:**
`~/Library/Application Support/Claude/claude_desktop_config.json`
Terminal: `open ~/Library/Application\ Support/Claude/`

**Test kaise karein?**
Claude Desktop open karo aur likho: `Mere brain agents batao`
Agar qa, jonqa, compiler dikhay — setup kamyab hai!

---

## Available MCP Tools

| Tool | What it does |
|------|-------------|
| `chat` | Talk to AI with brain context |
| `memory_read` | Read any memory key from D1 |
| `memory_write` | Save anything to D1 memory |
| `events_log` | Log a structured event |
| `agents_list` | List all registered agents |
| `system_status` | Full system status (memory/event counts) |
| `operate` | Read dashboard state or trigger agents |

---

## Verify MCP Works

```bash
curl -X POST https://caffeine-brain-worker.richard-brown-miami.workers.dev/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

Expected: `{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"caffeine-brain","version":"3.0"}}}`

---

**Worker version:** 3.0 (JSON-RPC 2.0 protocol, 7 tools)
**Worker URL:** https://caffeine-brain-worker.richard-brown-miami.workers.dev
**MCP endpoint:** /mcp
**Operate endpoint:** /operate (GET = read state, POST = write/trigger)
