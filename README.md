# Real-Time Collaborative Coding Platform

Several people edit the same file at once and see each other's changes, cursors, and presence as they type — plus a **Run** button that executes code in 8+ languages.

**Stack:** React · TypeScript · WebSockets · Redis Pub/Sub · Node.js · Yjs (CRDT) · CodeMirror 6

## 🚀 Live demo

- **App:** https://real-time-ide-client.vercel.app
- **Server health:** https://rtide-server.onrender.com/health

Open the app in two tabs (or share the link) and type — you'll see each other's
cursors live. Add `#anyroom` to the URL for a private room.

> ⏳ The first load after a quiet period can take ~50s: the server runs on
> Render's free tier, which spins down when idle and cold-starts on the next
> connection. Once awake it's instant.

## How it works

```
┌─────────────┐   WebSocket    ┌──────────────┐   Redis Pub/Sub   ┌──────────────┐
│  React app  │ ◄────────────► │  Node WS     │ ◄───────────────► │  Node WS     │
│  CodeMirror │   (per room)   │  server #1   │   (edit fan-out)  │  server #2   │
│  + Yjs      │                └──────────────┘                   └──────────────┘
└─────────────┘
```

- **Yjs (CRDT)** merges concurrent edits with no conflicts — no central lock, no operational-transform edge cases.
- **WebSockets** carry the Yjs sync protocol + awareness (cursors/presence) as a low-latency binary channel.
- **Redis Pub/Sub** fans every edit to sibling server instances, so users on different instances stay in sync — this is what makes the platform horizontally scalable.

## Features

- Live multi-cursor editing with conflict-free merging (Yjs CRDT)
- Presence avatars + remote cursor labels (Yjs awareness)
- File tree with 15+ languages and syntax highlighting
- Shareable room URLs (`#room-name`)
- **Run** button — executes JavaScript, Python, Java, C/C++, Rust, PHP, TypeScript
- Horizontally scalable via Redis Pub/Sub

## Project layout

```
client/   React + TypeScript + Vite + CodeMirror 6 + Yjs
server/   Node + TypeScript + ws + Redis (Yjs sync protocol) + /api/run
```

## Quick start

```bash
npm install                # installs both workspaces
npm run dev                # runs server (:1234) + client (:5173)
```

Open http://localhost:5173 in two browser tabs to collaborate.

## Testing live collaboration

1. Run `npm run dev` and open http://localhost:5173.
2. **Copy the full URL** (e.g. `http://localhost:5173/#default`) into a *second*
   tab or a different browser (or send it to a friend on your network).
3. Type in one — text, cursors, and the presence avatars (top-right) update in
   the other within milliseconds. Each tab gets a random name/color.
4. Named rooms: change the hash, e.g. `#myroom`. Same hash = same document.

## Running code

Click **▶ Run** in the editor toolbar. Where the code runs depends on the
language and environment:

| Language | Local dev | Production |
| --- | --- | --- |
| **JavaScript** | sandboxed Web Worker (in-browser) | sandboxed Web Worker (in-browser) |
| Python, Java, C/C++, Rust, PHP, TypeScript | self-hosted [Piston](https://github.com/engineer-man/piston) container | server `/api/run` → [Paiza.io](https://paiza.io) (free, keyless) |

- **JavaScript** always runs in the browser — no server, instant.
- In **production** the server proxies other languages to Paiza.io's keyless
  runner, so no API key or secret is needed anywhere.
- In **local dev**, set `VITE_PISTON_URL` (see below) to use a local Piston
  container instead; otherwise dev also falls back to the server `/api/run`.

### Optional: local Piston for offline execution

```bash
docker compose up -d piston
# install the language packs you want, e.g.:
curl -X POST http://localhost:2000/api/v2/packages -H 'content-type: application/json' -d '{"language":"python","version":"3.12.0"}'
# then in client/.env.local:
#   VITE_PISTON_URL=/piston-api   (routed via the Vite dev proxy)
```

### Multi-instance (proving Redis fan-out) — optional

```bash
docker run -p 6379:6379 redis          # start Redis
# terminal 1
REDIS_URL=redis://localhost:6379 PORT=1234 npm run dev:server
# terminal 2
REDIS_URL=redis://localhost:6379 PORT=1235 npm run dev:server
```

Point two clients at the two different ports — edits still sync via Redis.

## Environment variables

**Client** (`client/.env.local`, all optional):

| Var | Default | Purpose |
| --- | --- | --- |
| `VITE_WS_URL` | `ws://localhost:1234` | WebSocket server URL (`wss://…` in prod) |
| `VITE_API_URL` | derived from `VITE_WS_URL` | HTTP base for `/api/run` |
| `VITE_PISTON_URL` | — | If set, dev uses a local Piston instead of the server runner |

**Server** (all optional):

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `1234` | HTTP/WS port (Render sets this) |
| `REDIS_URL` | — | Enables Redis Pub/Sub fan-out when set |
| `PAIZA_URL` / `PAIZA_KEY` | `https://api.paiza.io` / `guest` | Code-execution backend for `/api/run` |

## Deployment

- **Client** → Vercel (static build) — set `VITE_WS_URL=wss://<your-server>`
- **Server + Redis** → Render (Node web service + Key Value store, via [`render.yaml`](./render.yaml))

See [`DEPLOY.md`](./DEPLOY.md).
