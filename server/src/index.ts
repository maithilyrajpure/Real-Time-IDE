/**
 * Real-time collaboration server.
 *
 *   HTTP  -> health check + tiny landing page
 *   WS    -> Yjs sync protocol, one URL path per room (ws://host/<room>)
 *   Redis -> cross-instance edit fan-out (optional, via REDIS_URL)
 */
import http from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';
import { Room } from './room.js';
import { handleMessage, encodeSyncStep1, encodeAwarenessUpdate } from './protocol.js';
import { createRedisBridge } from './redis.js';
import { runProgram, runnerReady } from './run.js';

const PORT = Number(process.env.PORT ?? 1234);
const REDIS_URL = process.env.REDIS_URL;
const PING_INTERVAL_MS = 30_000;

/** All live rooms on this instance, keyed by name. */
const rooms = new Map<string, Room>();

// --- Redis fan-out: apply sibling-instance changes to our local rooms --------
const redis = createRedisBridge(REDIS_URL, (roomName, kind, payload) => {
  const room = rooms.get(roomName);
  if (!room) return; // nobody here is in that room right now
  if (kind === 'update') room.applyRemoteUpdate(payload);
  else room.applyRemoteAwareness(payload);
});

function getOrCreateRoom(name: string): Room {
  let room = rooms.get(name);
  if (!room) {
    room = new Room(name, redis);
    rooms.set(name, room);
    console.log(`[room] created "${name}" (${rooms.size} active)`);
  }
  return room;
}

function roomNameFromUrl(url: string | undefined): string {
  // ws://host/<room>?params -> "<room>"; default room when path is empty.
  const path = (url ?? '/').split('?')[0].replace(/^\/+/, '');
  return decodeURIComponent(path) || 'default';
}

// --- HTTP server (health + code execution) -----------------------------------
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error('Body too large')); // 1 MB cap
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({ ok: true, rooms: rooms.size, redis: !!redis, run: runnerReady() })
    );
    return;
  }

  // Code execution endpoint (used by the client's Run button in production).
  if (req.url === '/api/run') {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405, CORS_HEADERS);
      res.end();
      return;
    }
    try {
      const body = (await readJsonBody(req)) as {
        language?: string;
        filename?: string;
        source?: string;
      };
      if (!body.language || typeof body.source !== 'string') {
        res.writeHead(400, { ...CORS_HEADERS, 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'language and source are required' }));
        return;
      }
      const result = await runProgram(body.language, body.filename ?? 'main', body.source);
      res.writeHead(200, { ...CORS_HEADERS, 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(502, { ...CORS_HEADERS, 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
    return;
  }

  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('Real-time IDE collaboration server. Connect over WebSocket.');
});

// --- WebSocket server ---------------------------------------------------------
const wss = new WebSocketServer({ server });

wss.on('connection', (conn: WebSocket, req: http.IncomingMessage) => {
  const roomName = roomNameFromUrl(req.url);
  const room = getOrCreateRoom(roomName);
  room.addConnection(conn);

  // Track which awareness client-ids this socket controls, so we can clear its
  // cursor/presence when it disconnects.
  const controlledIds = new Set<number>();
  const awarenessChangeHandler = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) => {
    if (origin !== conn) return;
    added.forEach((id) => controlledIds.add(id));
    updated.forEach((id) => controlledIds.add(id));
    removed.forEach((id) => controlledIds.delete(id));
  };
  room.awareness.on('update', awarenessChangeHandler);

  // Keepalive: mark alive on pong; a missed round trip terminates the socket.
  let isAlive = true;
  conn.on('pong', () => {
    isAlive = true;
  });
  const pingTimer = setInterval(() => {
    if (!isAlive) {
      conn.terminate();
      return;
    }
    isAlive = false;
    try {
      conn.ping();
    } catch {
      conn.terminate();
    }
  }, PING_INTERVAL_MS);

  conn.on('message', (data: Buffer, isBinary: boolean) => {
    if (!isBinary) return; // protocol is binary-only
    const reply = handleMessage(new Uint8Array(data), room.doc, room.awareness, conn);
    if (reply && conn.readyState === conn.OPEN) {
      conn.send(reply, { binary: true });
    }
  });

  const cleanup = () => {
    clearInterval(pingTimer);
    room.awareness.off('update', awarenessChangeHandler);
    // Remove this client's cursor/presence for everyone (also fans out via Redis).
    awarenessProtocol.removeAwarenessStates(room.awareness, Array.from(controlledIds), null);
    room.removeConnection(conn);
    if (room.isEmpty()) {
      room.destroy();
      rooms.delete(roomName);
      console.log(`[room] destroyed "${roomName}" (${rooms.size} active)`);
    }
  };
  conn.on('close', cleanup);
  conn.on('error', cleanup);

  // Handshake: send our state vector (sync step 1) and any existing awareness.
  conn.send(encodeSyncStep1(room.doc), { binary: true });
  const states = room.awareness.getStates();
  if (states.size > 0) {
    conn.send(encodeAwarenessUpdate(room.awareness, Array.from(states.keys())), { binary: true });
  }
});

server.listen(PORT, () => {
  console.log(`▶ collaboration server on :${PORT}  (redis: ${redis ? 'on' : 'off'})`);
});

// --- Graceful shutdown --------------------------------------------------------
async function shutdown() {
  console.log('\nshutting down…');
  wss.clients.forEach((c) => c.close());
  await redis?.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
