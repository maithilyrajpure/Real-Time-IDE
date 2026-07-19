/**
 * A Room owns one shared document (Y.Doc) and its awareness state
 * (cursors + presence) for a single collaboration session, plus the set of
 * local WebSocket connections editing it.
 *
 * Fan-out happens on two levels:
 *   1. Local:  doc/awareness change -> broadcast to every other local socket.
 *   2. Cross-instance: the same change is published to Redis so sibling
 *      server processes can apply it and broadcast to *their* local sockets.
 */
import type { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { encodeSyncUpdate, encodeAwarenessUpdate } from './protocol.js';
import type { RedisBridge } from './redis.js';

/** Origin tag used when applying updates that arrived via Redis, so we don't
 *  re-publish them back to Redis (which would loop forever). */
const REDIS_ORIGIN = Symbol('redis');

export class Room {
  readonly name: string;
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;
  readonly conns = new Set<WebSocket>();

  private readonly redis: RedisBridge | null;

  constructor(name: string, redis: RedisBridge | null) {
    this.name = name;
    this.redis = redis;
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    // The server itself is not a client, so it holds no local awareness state.
    this.awareness.setLocalState(null);

    this.doc.on('update', this.handleDocUpdate);
    this.awareness.on('update', this.handleAwarenessUpdate);

    if (this.redis) this.redis.subscribeRoom(this.name);
  }

  addConnection(conn: WebSocket): void {
    this.conns.add(conn);
  }

  removeConnection(conn: WebSocket): void {
    this.conns.delete(conn);
  }

  isEmpty(): boolean {
    return this.conns.size === 0;
  }

  /** Send a binary frame to every local socket, optionally skipping the origin. */
  private broadcastLocal(frame: Uint8Array, exclude?: unknown): void {
    for (const conn of this.conns) {
      if (conn === exclude) continue;
      if (conn.readyState === conn.OPEN) {
        conn.send(frame, { binary: true });
      }
    }
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown): void => {
    const frame = encodeSyncUpdate(update);
    // Re-broadcast to local peers (skip whoever produced the change).
    this.broadcastLocal(frame, origin);
    // Publish to siblings unless this update *arrived* from a sibling.
    if (this.redis && origin !== REDIS_ORIGIN) {
      this.redis.publish(this.name, 'update', update);
    }
  };

  private handleAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ): void => {
    const changed = added.concat(updated, removed);
    const frame = encodeAwarenessUpdate(this.awareness, changed);
    this.broadcastLocal(frame, origin);
    if (this.redis && origin !== REDIS_ORIGIN) {
      const payload = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed);
      this.redis.publish(this.name, 'awareness', payload);
    }
  };

  /** Apply a doc update that arrived from another instance via Redis. */
  applyRemoteUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update, REDIS_ORIGIN);
  }

  /** Apply an awareness update that arrived from another instance via Redis. */
  applyRemoteAwareness(update: Uint8Array): void {
    awarenessProtocol.applyAwarenessUpdate(this.awareness, update, REDIS_ORIGIN);
  }

  destroy(): void {
    if (this.redis) this.redis.unsubscribeRoom(this.name);
    this.awareness.destroy();
    this.doc.destroy();
  }
}
