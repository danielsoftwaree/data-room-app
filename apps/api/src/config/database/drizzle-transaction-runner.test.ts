import { describe, expect, test } from 'bun:test';
import type { Database } from '@repo/db';
import { transactionContext } from '../../shared/database/transaction';
import { DrizzleTransactionRunner } from './drizzle-transaction-runner';

/** A db whose `transaction` counts calls and hands out a recognizable tx object. */
function fakeDb() {
  const tx = { kind: 'tx' };
  const state = { calls: 0 };
  const db = {
    transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      state.calls += 1;
      return fn(tx);
    },
  } as unknown as Database;
  return { db, state, tx };
}

describe('DrizzleTransactionRunner', () => {
  test('publishes the transaction to the ambient context, then clears it', async () => {
    const { db, tx } = fakeDb();
    const runner = new DrizzleTransactionRunner(db);

    const seen = await runner.run(async () => transactionContext.current());
    expect(seen).toBe(tx as never);
    expect(transactionContext.current()).toBeUndefined();
  });

  test('a nested run joins the open transaction instead of starting a new one', async () => {
    const { db, state } = fakeDb();
    const runner = new DrizzleTransactionRunner(db);

    await runner.run(() => runner.run(async () => 'ok'));
    expect(state.calls).toBe(1);
  });

  test('a thrown error escapes run (so drizzle rolls back) and clears the context', async () => {
    const { db } = fakeDb();
    const runner = new DrizzleTransactionRunner(db);

    await expect(
      runner.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(transactionContext.current()).toBeUndefined();
  });
});
