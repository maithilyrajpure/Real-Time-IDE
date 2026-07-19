# Real-Time Collaborative Coding Platform

Several people edit the same file at once and see each other's changes, cursors, and presence as they type.

**Stack:** React · TypeScript · WebSockets · Redis Pub/Sub · Node.js · Yjs (CRDT) · CodeMirror 6

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

## Project layout

```
client/   React + TypeScript + Vite + CodeMirror 6 + Yjs
server/   Node + TypeScript + ws + Redis (Yjs sync protocol)
```

## Quick start

```bash
npm install                # installs both workspaces
npm run dev                # runs server (:1234) + client (:5173)
```

Open http://localhost:5173 in two browser tabs to collaborate.

### Multi-instance (proving Redis fan-out) — optional

```bash
docker run -p 6379:6379 redis          # start Redis
# terminal 1
REDIS_URL=redis://localhost:6379 PORT=1234 npm run dev:server
# terminal 2
REDIS_URL=redis://localhost:6379 PORT=1235 npm run dev:server
```

Point two clients at the two different ports — edits still sync via Redis.

## Deployment

- **Client** → Vercel (static build)
- **Server + Redis** → Render (Node web service + Key Value store)

See [`DEPLOY.md`](./DEPLOY.md).
