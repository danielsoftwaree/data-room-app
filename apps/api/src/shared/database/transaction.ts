import { AsyncLocalStorage } from 'node:async_hooks';
import type { DatabaseExecutor } from '@repo/db';

/**
 * Application-level unit of work. Services wrap multi-step writes in `run` so
 * either every step commits or none does. Repositories join the ambient
 * transaction transparently via `transactionContext` — no signature changes.
 */
export interface TransactionRunner {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

export const TRANSACTION_RUNNER = Symbol('TRANSACTION_RUNNER');

const storage = new AsyncLocalStorage<DatabaseExecutor>();

/** Carries the open transaction across async calls (repositories read it). */
export const transactionContext = {
  run<T>(executor: DatabaseExecutor, fn: () => Promise<T>): Promise<T> {
    return storage.run(executor, fn);
  },
  current(): DatabaseExecutor | undefined {
    return storage.getStore();
  },
};
