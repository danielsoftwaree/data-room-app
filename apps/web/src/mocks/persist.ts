/**
 * IndexedDB persistence for the dev mock store, so uploaded PDFs and other
 * state survive page reloads. Without it, the module-scope store re-seeds on
 * every reload and previously uploaded files 404 on open.
 *
 * Raw IndexedDB API (no new deps). Every failure degrades gracefully to
 * in-memory-only behavior - persistence is a dev nicety, never a requirement.
 */
import type { ActivityAction, Dataroom, DataroomNode, MemberRole, NodeType } from '@repo/domain';

const DB_NAME = 'dataroom-dev-mocks';
const DB_VERSION = 1;
const STORE_NAME = 'state';
// Bumped when the seed/shape changes so stale local snapshots are discarded.
// v4: file nodes carry shareSlug and the store persists share links.
const STATE_KEY = 'v4';

export interface PersistedFile {
  contentType: string;
  bytes: Uint8Array;
}

export interface PersistedMember {
  dataroomId: string;
  userId: string;
  role: MemberRole;
  createdAt: number;
}

export interface PersistedFavorite {
  userId: string;
  dataroomId: string;
  nodeId: string | null;
  createdAt: number;
}

export interface PersistedActivity {
  id: string;
  dataroomId: string;
  nodeId: string | null;
  nodeName: string | null;
  nodeType: NodeType | null;
  action: ActivityAction;
  actorId: string;
  createdAt: number;
}

export interface PersistedShare {
  nodeId: string;
  slug: string;
  /** Plaintext — mock only; the real API stores a one-way hash, never the password. */
  password: string;
  createdAt: number;
}

export interface PersistedState {
  datarooms: Dataroom[];
  nodes: DataroomNode[];
  members: PersistedMember[];
  favorites: PersistedFavorite[];
  activity: PersistedActivity[];
  shares: PersistedShare[];
  /** nodeId -> stored file content (Uint8Array survives structured clone). */
  files: [string, PersistedFile][];
  clock: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function loadPersistedState(): Promise<PersistedState | null> {
  try {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const request = db
          .transaction(STORE_NAME, 'readonly')
          .objectStore(STORE_NAME)
          .get(STATE_KEY);
        request.onsuccess = () => {
          resolve((request.result as PersistedState | undefined) ?? null);
        };
        request.onerror = () => reject(request.error ?? new Error('Failed to read mock state'));
      });
    } finally {
      db.close();
    }
  } catch {
    // Private mode / blocked storage: run without persistence.
    return null;
  }
}

// Writes are coalesced: at most one transaction in flight and one pending
// snapshot, so bursts of mutations do not queue a transaction each.
let writing = false;
let pending: PersistedState | null = null;

export function savePersistedState(state: PersistedState): void {
  pending = state;
  if (!writing) void flush();
}

async function flush(): Promise<void> {
  writing = true;
  try {
    while (pending) {
      const state = pending;
      pending = null;
      const db = await openDatabase();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(state, STATE_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error('Failed to write mock state'));
          tx.onabort = () => reject(tx.error ?? new Error('Mock state write aborted'));
        });
      } finally {
        db.close();
      }
    }
  } catch (error) {
    console.warn('[mocks] Could not persist mock state to IndexedDB:', error);
  } finally {
    writing = false;
  }
}

export async function clearPersistedState(): Promise<void> {
  try {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(STATE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Failed to clear mock state'));
        tx.onabort = () => reject(tx.error ?? new Error('Mock state clear aborted'));
      });
    } finally {
      db.close();
    }
  } catch (error) {
    console.warn('[mocks] Could not clear persisted mock state:', error);
  }
}
