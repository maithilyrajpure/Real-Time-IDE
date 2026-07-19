/**
 * useCollab — owns the Y.Doc + WebSocket provider for a room and exposes
 * reactive views of the shared state (connection status, file list, peers).
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

export interface Collab {
  doc: Y.Doc;
  provider: WebsocketProvider;
  identity: UserIdentity;
  status: 'connecting' | 'connected' | 'disconnected';
  files: FileMeta[];
  peers: Peer[];
}

export function useCollab(room: string): Collab {
  const identity = useMemo(() => getUserIdentity(), []);

  // Create the doc + provider exactly once per room.
  const { doc, provider } = useMemo(() => {
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(WS_URL, room, doc, { connect: true });
    provider.awareness.setLocalStateField('user', identity);
    return { doc, provider };
  }, [room, identity]);

  const [status, setStatus] = useState<Collab['status']>('connecting');
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    const onStatus = (e: { status: 'connecting' | 'connected' | 'disconnected' }) =>
      setStatus(e.status);
    provider.on('status', onStatus);

    // Once we're synced, make sure the room has at least the welcome file.
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
    };
  }, [doc, provider]);

  // Tear down when the room changes or the component unmounts.
  useEffect(() => {
    return () => {
      provider.destroy();
      doc.destroy();
    };
  }, [doc, provider]);

  return { doc, provider, identity, status, files, peers };
}
