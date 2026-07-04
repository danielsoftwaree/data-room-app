import { describe, expect, test } from 'bun:test';
import { isUniqueViolation } from './database';

describe('isUniqueViolation', () => {
  test('detects a bare pg unique violation', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  test('detects a violation wrapped by drizzle (pg error in the cause chain)', () => {
    const wrapped = new Error('Failed query: insert into "nodes" ...');
    (wrapped as Error & { cause: unknown }).cause = { code: '23505' };
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  test('rejects other errors', () => {
    expect(isUniqueViolation(new Error('nope'))).toBe(false);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
