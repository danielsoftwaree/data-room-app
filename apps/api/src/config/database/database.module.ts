import { Global, Inject, Injectable, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { Database } from '@repo/db';
import * as schema from '@repo/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { getDatabasePoolMax, getDatabaseUrl } from '../env/env';
import { DatabaseMigrator } from './database.migrator';
import { DRIZZLE, PG_POOL } from './database.tokens';

@Injectable()
class PgPoolShutdown implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () =>
        new Pool({
          connectionString: getDatabaseUrl(),
          max: getDatabasePoolMax(),
        }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Database => drizzle(pool, { schema }),
    },
    DatabaseMigrator,
    PgPoolShutdown,
  ],
  exports: [DRIZZLE, DatabaseMigrator],
})
export class DatabaseModule {}
