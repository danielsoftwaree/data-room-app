import { Global, Inject, Injectable, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { createDatabase } from '@repo/db';
import type { Database, DatabaseConnection, Pool } from '@repo/db';
import { EnvService } from '../env';
import { DRIZZLE, PG_POOL } from './database.tokens';

const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');

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
      provide: DATABASE_CONNECTION,
      inject: [EnvService],
      useFactory: (env: EnvService): DatabaseConnection =>
        createDatabase({
          url: env.get('DATABASE_URL'),
          poolMax: env.get('DATABASE_POOL_MAX'),
        }),
    },
    {
      provide: PG_POOL,
      inject: [DATABASE_CONNECTION],
      useFactory: (connection: DatabaseConnection): Pool => connection.pool,
    },
    {
      provide: DRIZZLE,
      inject: [DATABASE_CONNECTION],
      useFactory: (connection: DatabaseConnection): Database => connection.db,
    },
    PgPoolShutdown,
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
