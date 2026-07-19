/**
 * Yjs WebSocket wire protocol.
 *
 * Every message is a binary frame whose first byte is a message type, followed
 * by a type-specific payload. This matches the y-websocket protocol so the
 * standard `y-websocket` / `y-protocols` client works against our server.
 */
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as Y from 'yjs';

export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;

/** Build a sync-step-1 frame (our state vector) to kick off a handshake. */
export function encodeSyncStep1(doc: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

/** Wrap a raw Yjs document update as a sync-update frame. */
export function encodeSyncUpdate(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

/** Encode an awareness (cursor/presence) update for the given client ids. */
export function encodeAwarenessUpdate(
  awareness: awarenessProtocol.Awareness,
  clients: number[]
): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(awareness, clients)
  );
  return encoding.toUint8Array(encoder);
}

/**
 * Decode an inbound frame from a client and mutate doc/awareness accordingly.
 * Returns a reply frame to send back to that client, or null if none is needed
 * (e.g. an awareness update, which is fanned out via the awareness listener).
 */
export function handleMessage(
  message: Uint8Array,
  doc: Y.Doc,
  awareness: awarenessProtocol.Awareness,
  origin: unknown
): Uint8Array | null {
  const decoder = decoding.createDecoder(message);
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case MESSAGE_SYNC: {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      // readSyncMessage applies incoming updates to `doc` (tagged with origin)
      // and writes any needed reply (e.g. sync-step-2) into `encoder`.
      syncProtocol.readSyncMessage(decoder, encoder, doc, origin);
      // Only bytes beyond the type byte mean there's an actual reply to send.
      if (encoding.length(encoder) > 1) {
        return encoding.toUint8Array(encoder);
      }
      return null;
    }
    case MESSAGE_AWARENESS: {
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        decoding.readVarUint8Array(decoder),
        origin
      );
      return null;
    }
    default:
      return null;
  }
}
