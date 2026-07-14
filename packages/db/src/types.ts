import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

/** The client drizzle hands to a `db.transaction(...)` callback. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Anything queries can run on: the pooled client or an open transaction. */
export type DatabaseExecutor = Database | Transaction;
