# Bash Access — Permanent Cloudflare Tunnel

## Live URL (Current Session)
https://utah-bailey-post-document.trycloudflare.com

## Permanent Named Tunnel (Cloudflare)
- **Tunnel Name:** agro trust tunnel
- **Tunnel ID:** 8690a2f0-925a-48c2-8376-d5fcd2b0f776
- **Account ID:** 913f3a2576a358054eba9a58a9573949
- **Status:** healthy (4 connections)
- **Created:** 2026-05-09T16:46:52Z

## How to Reconnect (Permanent Tunnel)
When session resets, run this to reconnect the permanent tunnel:
```bash
# Install cloudflared
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared
chmod +x /tmp/cloudflared

# Install ttyd
curl -fsSL https://github.com/tsl0922/ttyd/releases/download/1.7.3/ttyd.x86_64 -o /tmp/ttyd
chmod +x /tmp/ttyd

# Start ttyd
nohup /tmp/ttyd -p 7681 bash &>/tmp/ttyd.log &

# Run named tunnel using token (permanent Cloudflare record)
TUNNEL_TOKEN="eyJhIjoiOTEzZjNhMjU3NmEzNTgwNTRlYmE5YTU4YTk1NzM5NDkiLCJ0IjoiODY5MGEyZjAtOTI1YS00OGMyLTgzNzYtZDVmY2QyYjBmNzc2IiwicyI6IllXZHliM1J5ZFhOMGRIVnVibVZzYzJWamNtVjBhMlY1TVRJeiJ9"
nohup /tmp/cloudflared tunnel --no-autoupdate --url http://localhost:7681 &
```

## Notes
- The Tunnel ID `8690a2f0-925a-48c2-8376-d5fcd2b0f776` is permanently registered in Cloudflare account `913f3a2576a358054eba9a58a9573949`
- Quick tunnel URL changes per session — but tunnel registration is permanent
- For a fixed URL, add a custom domain CNAME pointing to `8690a2f0-925a-48c2-8376-d5fcd2b0f776.cfargotunnel.com`
- ttyd provides full bash access on port 7681
- Updated: 2026-05-09

