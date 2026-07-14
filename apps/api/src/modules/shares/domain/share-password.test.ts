import { describe, expect, test } from 'bun:test';
import { hashSharePassword, verifySharePassword } from './share-password';

describe('share-password', () => {
  test('round-trips a correct password', async () => {
    const stored = await hashSharePassword('hunter2');
    expect(stored.startsWith('scrypt:')).toBe(true);
    expect(await verifySharePassword('hunter2', stored)).toBe(true);
  });

  test('rejects a wrong password', async () => {
    const stored = await hashSharePassword('hunter2');
    expect(await verifySharePassword('Hunter2', stored)).toBe(false);
    expect(await verifySharePassword('', stored)).toBe(false);
  });

  test('uses a fresh salt per hash (same password → different digests)', async () => {
    const a = await hashSharePassword('same');
    const b = await hashSharePassword('same');
    expect(a).not.toBe(b);
    expect(await verifySharePassword('same', a)).toBe(true);
    expect(await verifySharePassword('same', b)).toBe(true);
  });

  test('preserves spaces (passwords are not trimmed)', async () => {
    const stored = await hashSharePassword('  spaced  ');
    expect(await verifySharePassword('  spaced  ', stored)).toBe(true);
    expect(await verifySharePassword('spaced', stored)).toBe(false);
  });

  test('returns false on a malformed stored value instead of throwing', async () => {
    for (const stored of [
      '',
      'not-a-hash',
      'scrypt:only-two',
      'bcrypt:c2FsdA:aGFzaA',
      'scrypt::',
      'scrypt:c2FsdA:',
    ]) {
      expect(await verifySharePassword('whatever', stored)).toBe(false);
    }
  });
});
