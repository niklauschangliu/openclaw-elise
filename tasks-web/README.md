# OpenClaw Tasks Web (SSE dashboard)

Goal: replace the desktop EXE with a **pure Web dashboard** + a **local always-on state service**.

- Frontend is **static** (GitHub Pages compatible)
- Backend runs **locally** next to your OpenClaw Gateway
- Backend connects to the Gateway **WebSocket protocol** (event-driven)
- Frontend receives updates via **SSE** (no polling)

## Components

### 1) status-service (Node)
- Connects to `ws://127.0.0.1:18789` (OpenClaw Gateway WS)
- On connect, receives `hello-ok.snapshot` and streams all subsequent `event` frames to browsers
- Exposes:
  - `GET /health` (no auth)
  - `GET /state` (auth)
  - `GET /events` (SSE, auth)

Auth: `DASHBOARD_TOKEN` (Bearer). For SSE, the demo also allows `?token=` because EventSource cannot send headers.

### 2) dashboard (Vite + React)
- `GET /state` once at load
- Opens `EventSource(/events?token=...)` for real-time updates

## Local dev

### Start status-service

```bat
cd tasks-web\status-service
set DASHBOARD_TOKEN=devtoken123
set GATEWAY_TOKEN=<your openclaw gateway token>
node index.js
```

Gateway token is currently stored in `C:\Users\elise\.openclaw\openclaw.json` at `gateway.auth.token`.

### Start dashboard

```bat
cd tasks-web\dashboard
set VITE_API_BASE=http://127.0.0.1:8787
set VITE_DASHBOARD_TOKEN=devtoken123
npm run dev
```

## Free public access (no Cloudflare account)

Use **Cloudflare Quick Tunnel** (no login) to expose the **backend**.

1) Install cloudflared (one-time).
2) Run:

```bat
cloudflared tunnel --url http://127.0.0.1:8787
```

This prints a public `https://....trycloudflare.com` URL.

Then build the dashboard for GitHub Pages using that URL:

```bat
cd tasks-web\dashboard
set VITE_API_BASE=https://<trycloudflare-url>
set VITE_DASHBOARD_TOKEN=<your token>
npm run build
```

Notes:
- Quick Tunnel URLs **change** when restarted. For a stable URL you need a free Cloudflare account (still free) or another tunnel provider.
- Token-in-query-string is acceptable for quick/private usage but not ideal. Next hardening step is to move auth to the tunnel (Access) or switch to WebSocket and use headers.
