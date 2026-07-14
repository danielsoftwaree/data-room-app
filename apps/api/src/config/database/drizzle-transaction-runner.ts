import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '@repo/db';
import { transactionContext } from '../../shared/database/transaction';
import type { TransactionRunner } from '../../shared/database/transaction';
import { DRIZZLE } from './database.tokens';

/**
 * Runs the callback inside one PostgreSQL transaction and publishes it via
 * `transactionContext`, so every repository call within joins it. A nested
 * `run` joins the already-open transaction instead of starting a new one.
 */
@Injectable()
export class DrizzleTransactionRunner implements TransactionRunner {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    if (transactionContext.current()) return fn();
    return this.db.transaction((tx) => transactionContext.run(tx, fn));
  }
}
