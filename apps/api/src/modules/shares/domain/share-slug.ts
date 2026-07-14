import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** DI token for the HMAC secret behind share-link slugs (see SHARE_LINK_SECRET). */
export const SHARE_LINK_SECRET = Symbol('SHARE_LINK_SECRET');

const UUID_BYTES = 16;
const NONCE_BYTES = 4;
const MAC_BYTES = 10;

/**
 * Share slugs are signed with a server-side secret instead of being purely
 * random: `base64url(nodeId ‖ nonce ‖ HMAC-SHA256(secret, nodeId ‖ nonce))`.
 * The public endpoints verify the signature before touching the database, so a
 * forged or mistyped slug is rejected without a lookup, and a slug can only
 * ever be minted by a server that holds the secret. The nonce keeps slugs
 * unguessable and makes remove + recreate produce a fresh address. The row in
 * node_shares stays the source of truth for revocation.
 *
 * TECH DEBT (test-task scope): the secret lives in env config with a committed
 * dev fallback, and links minted before this scheme (plain random slugs) stop
 * verifying — acceptable here, would need a migration path in production.
 */
export function createShareSlug(nodeId: string, secret: string): string {
  const payload = Buffer.concat([uuidBytes(nodeId), randomBytes(NONCE_BYTES)]);
  return Buffer.concat([payload, mac(payload, secret)]).toString('base64url');
}

/** Constant-time signature check. Returns false (never throws) on any malformed slug. */
export function verifyShareSlug(slug: string, secret: string): boolean {
  const raw = Buffer.from(slug, 'base64url');
  if (raw.length !== UUID_BYTES + NONCE_BYTES + MAC_BYTES) return false;
  const payload = raw.subarray(0, UUID_BYTES + NONCE_BYTES);
  const signature = raw.subarray(UUID_BYTES + NONCE_BYTES);
  const expected = mac(payload, secret);
  return signature.length === expected.length && timingSafeEqual(signature, expected);
}

function mac(payload: Buffer, secret: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest().subarray(0, MAC_BYTES);
}

function uuidBytes(id: string): Buffer {
  const hex = id.replace(/-/g, '');
  const bytes = Buffer.from(hex, 'hex');
  if (hex.length !== UUID_BYTES * 2 || bytes.length !== UUID_BYTES) {
    throw new Error('Share slugs can only be minted for UUID node ids');
  }
  return bytes;
}
