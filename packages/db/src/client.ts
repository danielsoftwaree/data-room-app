import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import type { Database } from './types';

export interface CreateDatabaseOptions {
  url: string;
  poolMax: number;
}

export interface DatabaseConnection {
  db: Database;
  pool: Pool;
}

export function createDatabase(options: CreateDatabaseOptions): DatabaseConnection {
  const pool = new Pool({
    connectionString: options.url,
    max: options.poolMax,
  });

  return {
    db: drizzle(pool, { schema }),
    pool,
  };
}
