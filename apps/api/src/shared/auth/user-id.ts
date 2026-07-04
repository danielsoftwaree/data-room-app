import { createHash } from 'node:crypto';

/**
 * Maps a Clerk user id (an opaque string like `user_2abc...`) to a stable
 * internal UUID, because the `users` table keys on `uuid` and cannot store the
 * raw Clerk id. This is a deterministic UUIDv5 (RFC 4122) so the same Clerk
 * account always resolves to the same row — no schema change, no lookup table.
 */
const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

export function clerkIdToUserId(clerkId: string): string {
  return uuidv5(clerkId, NAMESPACE);
}

/** Deterministic avatar colour from the internal id, drawn from the app palette. */
const PALETTE = ['#5865f2', '#35ed7e', '#a78bfa', '#f6c956', '#ec48bd', '#00b0f4'] as const;

export function colorForUser(id: string): string {
  let sum = 0;
  for (const char of id) sum = (sum + char.charCodeAt(0)) % 997;
  return PALETTE[sum % PALETTE.length];
}

function uuidv5(name: string, namespace: string): string {
  const namespaceBytes = uuidToBytes(namespace);
  const hash = createHash('sha1')
    .update(Buffer.concat([namespaceBytes, Buffer.from(name, 'utf8')]))
    .digest();
  const bytes = Uint8Array.prototype.slice.call(hash, 0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  return formatUuid(bytes);
}

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}
