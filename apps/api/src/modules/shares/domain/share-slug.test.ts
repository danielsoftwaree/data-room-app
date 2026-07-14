import { randomUUID } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import { createShareSlug, verifyShareSlug } from './share-slug';

const SECRET = 'test-share-link-secret';

describe('share-slug', () => {
  test('a minted slug verifies with the same secret', () => {
    const slug = createShareSlug(randomUUID(), SECRET);
    expect(verifyShareSlug(slug, SECRET)).toBe(true);
  });

  test('the nonce makes slugs unique per mint', () => {
    const nodeId = randomUUID();
    expect(createShareSlug(nodeId, SECRET)).not.toBe(createShareSlug(nodeId, SECRET));
  });

  test('rejects a slug minted with a different secret', () => {
    const slug = createShareSlug(randomUUID(), 'some-other-secret-value');
    expect(verifyShareSlug(slug, SECRET)).toBe(false);
  });

  test('rejects tampered and malformed slugs without throwing', () => {
    const slug = createShareSlug(randomUUID(), SECRET);
    const tampered = (slug.startsWith('A') ? 'B' : 'A') + slug.slice(1);
    expect(verifyShareSlug(tampered, SECRET)).toBe(false);
    expect(verifyShareSlug('', SECRET)).toBe(false);
    expect(verifyShareSlug('not-base64url!!!', SECRET)).toBe(false);
    expect(verifyShareSlug('c2hvcnQ', SECRET)).toBe(false);
  });

  test('only mints slugs for UUID node ids', () => {
    expect(() => createShareSlug('file-1', SECRET)).toThrow();
  });
});
