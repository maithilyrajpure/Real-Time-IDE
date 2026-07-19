/** Presence bar: an avatar per connected peer, colored to match their cursor. */
import type { Peer } from '../collab/useCollab';

interface PresenceProps {
  peers: Peer[];
}

function initials(name: string): string {
  const parts = name.split(/\s+/);
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

export default function Presence({ peers }: PresenceProps) {
  return (
    <div className="presence" title={`${peers.length} online`}>
      {peers.map((p) => (
        <div
          key={p.clientId}
          className="avatar"
          style={{ backgroundColor: p.color }}
          title={p.isSelf ? `${p.name} (you)` : p.name}
        >
          {initials(p.name)}
          {p.isSelf && <span className="avatar__self" />}
        </div>
      ))}
    </div>
  );
}
