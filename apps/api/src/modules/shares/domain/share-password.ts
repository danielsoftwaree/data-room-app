import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const SALT_BYTES = 16;
const KEY_LENGTH = 32;
const PREFIX = 'scrypt';

/**
 * Hashes a share-link password with node:crypto scrypt (no external deps).
 * Encoded as `scrypt:<salt base64url>:<hash base64url>` so the salt travels with
 * the digest — every call uses a fresh random salt.
 */
export async function hashSharePassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${PREFIX}:${salt.toString('base64url')}:${derived.toString('base64url')}`;
}

/**
 * Verifies a password against a stored `scrypt:<salt>:<hash>` value using a
 * constant-time comparison. Returns false (never throws) on any malformed stored
 * value, so a corrupt row can never crash the public unlock path.
 */
export async function verifySharePassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;

  const salt = Buffer.from(parts[1], 'base64url');
  const expected = Buffer.from(parts[2], 'base64url');
  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = (await scryptAsync(password, salt, expected.length)) as Buffer;
  } catch {
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
