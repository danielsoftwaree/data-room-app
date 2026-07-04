import { dirname, join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './types';

const packageRoot = join(dirname(__dirname));
const migrationsFolder = join(packageRoot, 'migrations');

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder });
}
