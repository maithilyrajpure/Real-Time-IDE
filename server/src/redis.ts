/**
 * Redis Pub/Sub bridge for horizontal scale-out.
 *
 * Each server instance publishes every local edit / awareness change to a
 * per-room Redis channel, and subscribes to those same channels to receive
 * changes produced by *other* instances. That is what lets two users connected
 * to two different server processes see each other's edits in real time.
 *
 * Redis is OPTIONAL: with no REDIS_URL, `createRedisBridge` returns null and a
 * single instance still works perfectly (edits fan out over local WebSockets).
 */
import Redis from 'ioredis';

/** A distinct id per process so an instance can ignore its own echoed messages. */
export const INSTANCE_ID = `${process.pid}-${Math.floor(process.uptime() * 1e6)}`;

export type RedisMessageHandler = (
  room: string,
  kind: 'update' | 'awareness',
  payload: Uint8Array,
  senderInstance: string
) => void;

export interface RedisBridge {
  publish(room: string, kind: 'update' | 'awareness', payload: Uint8Array): void;
  subscribeRoom(room: string): void;
  unsubscribeRoom(room: string): void;
  close(): Promise<void>;
}

function channelFor(room: string): string {
  return `rtide:room:${room}`;
}

/**
 * Wire framing inside a Redis message:
 *   [instanceIdLen:1][instanceId][kind:1][payload...]
 * kind: 0 = doc update, 1 = awareness update.
 */
function encodeRedisMessage(
  kind: 'update' | 'awareness',
  payload: Uint8Array
): Buffer {
  const idBuf = Buffer.from(INSTANCE_ID, 'utf8');
  const kindByte = Buffer.from([kind === 'update' ? 0 : 1]);
  return Buffer.concat([Buffer.from([idBuf.length]), idBuf, kindByte, Buffer.from(payload)]);
}

function decodeRedisMessage(buf: Buffer): {
  senderInstance: string;
  kind: 'update' | 'awareness';
  payload: Uint8Array;
} {
  const idLen = buf[0];
  const senderInstance = buf.subarray(1, 1 + idLen).toString('utf8');
  const kind = buf[1 + idLen] === 0 ? 'update' : 'awareness';
  const payload = new Uint8Array(buf.subarray(2 + idLen));
  return { senderInstance, kind, payload };
}

export function createRedisBridge(
  redisUrl: string | undefined,
  onMessage: RedisMessageHandler
): RedisBridge | null {
  if (!redisUrl) return null;

  // ioredis needs separate connections for publishing and subscribing.
  const pub = new Redis(redisUrl, { lazyConnect: false });
  const sub = new Redis(redisUrl, { lazyConnect: false });

  pub.on('error', (err) => console.error('[redis:pub] error', err.message));
  sub.on('error', (err) => console.error('[redis:sub] error', err.message));

  // Map channel -> room so we can route incoming messages back to rooms.
  const channelToRoom = new Map<string, string>();

  sub.on('messageBuffer', (channelBuf: Buffer, messageBuf: Buffer) => {
    const channel = channelBuf.toString('utf8');
    const room = channelToRoom.get(channel);
    if (!room) return;
    const { senderInstance, kind, payload } = decodeRedisMessage(messageBuf);
    if (senderInstance === INSTANCE_ID) return; // ignore our own echo
    onMessage(room, kind, payload, senderInstance);
  });

  return {
    publish(room, kind, payload) {
      pub.publish(channelFor(room), encodeRedisMessage(kind, payload));
    },
    subscribeRoom(room) {
      const channel = channelFor(room);
      if (channelToRoom.has(channel)) return;
      channelToRoom.set(channel, room);
      sub.subscribe(channel).catch((err) =>
        console.error('[redis:sub] subscribe failed', err.message)
      );
    },
    unsubscribeRoom(room) {
      const channel = channelFor(room);
      if (!channelToRoom.has(channel)) return;
      channelToRoom.delete(channel);
      sub.unsubscribe(channel).catch(() => {});
    },
    async close() {
      await Promise.allSettled([pub.quit(), sub.quit()]);
    },
  };
}
