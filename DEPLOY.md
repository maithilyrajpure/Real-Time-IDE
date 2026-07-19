# Deployment

Two pieces deploy separately:

| Piece            | Host    | Why                                             |
| ---------------- | ------- | ----------------------------------------------- |
| Client (React)   | Vercel  | Static build, global CDN                         |
| Server (Node WS) | Render  | WebSockets need a **persistent** process         |
| Redis            | Render  | Managed Key Value store for cross-instance fan-out |

> ⚠️ The WebSocket server **cannot** run on Vercel/Netlify serverless functions —
> those are request-scoped and drop long-lived socket connections. It needs a
> real always-on host (Render, Railway, Fly.io).

---

## 1. Deploy the server + Redis on Render

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, point it at the repo. Render reads
   [`render.yaml`](./render.yaml) and provisions:
   - `rtide-server` — the Node web service
   - `rtide-redis` — managed Redis, auto-wired into the server as `REDIS_URL`
3. After it goes live, note the URL, e.g. `https://rtide-server.onrender.com`.
   Your WebSocket URL is the same host with `wss://`:
   `wss://rtide-server.onrender.com`.

Health check: `https://rtide-server.onrender.com/health` →
`{"ok":true,"rooms":N,"redis":true}` (`redis:true` confirms fan-out is active).

## 2. Deploy the client on Vercel

1. In Vercel: **New Project** → import the repo.
2. Set **Root Directory** to `client`.
3. Add an environment variable:
   - `VITE_WS_URL = wss://rtide-server.onrender.com`
4. Deploy. Vercel uses [`client/vercel.json`](./client/vercel.json) (Vite preset).

Open the deployed URL in two browsers to collaborate. Add `#anyroom` to the URL
to create/join a named room.

## 3. Scaling (the point of Redis)

Because every edit fans out through Redis Pub/Sub, you can raise the server's
instance count in Render and users on **different** instances stay in sync. To
prove it locally without deploying:

```bash
docker compose up --build
# server-a on :1234, server-b on :1235, sharing one Redis
```

Point one client at `ws://localhost:1234` and another at `ws://localhost:1235`
(via `VITE_WS_URL`) — edits cross between them through Redis.

---

### Alternative hosts

- **Railway** — put the server + a Redis plugin in one project; set `REDIS_URL`
  from the plugin. Build with `server/Dockerfile`.
- **Fly.io** — `fly launch` from `server/Dockerfile`, add Upstash Redis, set
  `REDIS_URL`. Good for multi-region low latency.
