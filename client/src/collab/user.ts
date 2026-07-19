/** A local user's identity, shared with peers via Yjs awareness. */
export interface UserIdentity {
  name: string;
  color: string;
}

// Distinct, high-contrast cursor colors that read well on the dark editor.
const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4',
];

const ANIMALS = [
  'Otter', 'Falcon', 'Panda', 'Lynx', 'Heron', 'Bison',
  'Koala', 'Raven', 'Tapir', 'Gecko', 'Marten', 'Wren',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Create (or restore) this browser's identity, persisted for the session. */
export function getUserIdentity(): UserIdentity {
  const stored = sessionStorage.getItem('rtide:user');
  if (stored) {
    try {
      return JSON.parse(stored) as UserIdentity;
    } catch {
      /* fall through and regenerate */
    }
  }
  const identity: UserIdentity = {
    name: `${pick(ANIMALS)} ${Math.floor(100 + Math.random() * 900)}`,
    color: pick(COLORS),
  };
  sessionStorage.setItem('rtide:user', JSON.stringify(identity));
  return identity;
}
