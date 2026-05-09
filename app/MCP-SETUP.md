# MCP Setup Guide — Caffeine Brain Worker

## What is MCP?
MCP (Model Context Protocol) allows Claude Desktop or Cursor to connect directly to your Caffeine Brain Worker.
After setup, Claude can read/write memory, log events, list agents, and operate the Brain Dashboard — all from inside your chat.

---

## Quick Config

**Worker URL:** `https://caffeine-brain-worker.richard-brown-miami.workers.dev/mcp`

**Config to paste:**
```json
{
  "mcpServers": {
    "caffeine-brain": {
      "url": "https://caffeine-brain-worker.richard-brown-miami.workers.dev/mcp"
    }
  }
}
```

---

## Step-by-Step: Claude Desktop

### Windows
1. Download Claude Desktop from https://claude.ai/download
2. Open the config file at:
   `C:\Users\YourName\AppData\Roaming\Claude\claude_desktop_config.json`
3. Paste the config JSON above into the file
4. Save and restart Claude Desktop
5. In Claude, type: `List my brain agents` — you should see qa, jonqa, compiler

### Mac
1. Download Claude Desktop from https://claude.ai/download
2. Open the config file at:
   `~/Library/Application Support/Claude/claude_desktop_config.json`
3. Paste the config JSON above into the file
4. Save and restart Claude Desktop
5. In Claude, type: `List my brain agents` — you should see qa, jonqa, compiler

---

## Urdu/Hindi Guide

**MCP kya hai?**
MCP (Model Context Protocol) aapko Claude Desktop ko apne Caffeine Brain Worker se connect karne deta hai.
Setup ke baad, Claude seedha memory read/write kar sakta hai, events log kar sakta hai, agents list kar sakta hai — sab kuch chat ke andar se.

**Windows mein config kahan hai?**
`C:\Users\AapKaNaam\AppData\Roaming\Claude\claude_desktop_config.json`
File nahi dikh rahi? File Explorer mein 'Hidden Items' show karo.

**Mac mein config kahan hai?**
`~/Library/Application Support/Claude/claude_desktop_config.json`
Terminal mein yeh run karo:
`open ~/Library/Application\ Support/Claude/`

**Test kaise karein?**
Claude Desktop open karo aur likho: `Mere brain agents batao`
Agar qa, jonqa, compiler dikhay — setup kamyab hai ✅

---

## Available Tools (MCP se)

| Tool | Kya karta hai |
|------|--------------|
| `chat` | AI se baat karo brain context ke saath |
| `memory_read` | Koi memory key read karo |
| `memory_write` | Memory mein kuch save karo |
| `events_log` | Event log karo |
| `agents_list` | Sab agents ki list dekho |
| `system_status` | Full system status dekho |
| `operate` | Dashboard state read/write karo |

---

## Verify MCP is Working

```bash
# Test initialize handshake
curl -X POST https://caffeine-brain-worker.richard-brown-miami.workers.dev/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# Expected: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05",...}}
```

**Config file location:** `app/mcp-config.json` in this repo
**Worker version:** 3.0 (JSON-RPC 2.0 protocol)
**Last updated:** 2026-05-09

