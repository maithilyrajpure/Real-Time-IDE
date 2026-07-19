/**
 * useCollab — owns the Y.Doc + WebSocket provider for a room and exposes
 * reactive views of the shared state (connection status, file list, peers).
 *
 * The provider is created AND destroyed inside a single effect. This is what
 * makes it survive React 18 StrictMode's mount → unmount → remount cycle in dev:
 * each mount builds a fresh provider, so a torn-down socket is never reused.
 */
import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { getUserIdentity, type UserIdentity } from './user';
import { ensureSeedFiles, listFiles, type FileMeta } from './session';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:1234';

export interface Peer extends UserIdentity {
  clientId: number;
  isSelf: boolean;
}

export type Status = 'connecting' | 'connected' | 'disconnected';

export interface Collab {
  /** doc + provider are null until the effect has created them (first paint). */
  doc: Y.Doc | null;
  provider: WebsocketProvider | null;
  identity: UserIdentity;
  status: Status;
  files: FileMeta[];
  peers: Peer[];
}

export function useCollab(room: string): Collab {
  const identity = useMemo(() => getUserIdentity(), []);

  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(WS_URL, room, doc, { connect: true });
    provider.awareness.setLocalStateField('user', identity);
    setDoc(doc);
    setProvider(provider);

    const onStatus = (e: { status: Status }) => setStatus(e.status);
    provider.on('status', onStatus);

    // Once synced, make sure the room has at least the welcome file.
    const onSync = (isSynced: boolean) => {
      if (isSynced) ensureSeedFiles(doc);
    };
    provider.on('sync', onSync);

    // Reactive file list.
    const refreshFiles = () => setFiles(listFiles(doc));
    doc.getMap('files').observe(refreshFiles);
    refreshFiles();

    // Reactive peer list from awareness.
    const refreshPeers = () => {
      const states = provider.awareness.getStates();
      const selfId = provider.awareness.clientID;
      const next: Peer[] = [];
      states.forEach((state, clientId) => {
        const user = (state as { user?: UserIdentity }).user;
        if (!user) return;
        next.push({ ...user, clientId, isSelf: clientId === selfId });
      });
      setPeers(next.sort((a, b) => Number(b.isSelf) - Number(a.isSelf)));
    };
    provider.awareness.on('change', refreshPeers);
    refreshPeers();

    return () => {
      provider.off('status', onStatus);
      provider.off('sync', onSync);
      doc.getMap('files').unobserve(refreshFiles);
      provider.awareness.off('change', refreshPeers);
      provider.destroy();
      doc.destroy();
      setDoc(null);
      setProvider(null);
      setStatus('connecting');
    };
  }, [room, identity]);

  return { doc, provider, identity, status, files, peers };
}
