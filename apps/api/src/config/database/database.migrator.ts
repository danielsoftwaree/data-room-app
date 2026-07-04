import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '@repo/db';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { DRIZZLE } from './database.tokens';

@Injectable()
export class DatabaseMigrator {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async run(): Promise<void> {
    await migrate(this.db, { migrationsFolder: resolveMigrationsFolder() });
  }
}

function resolveMigrationsFolder(): string {
  const requireFromHere = createRequire(__filename);
  const dbPackageRoot = dirname(requireFromHere.resolve('@repo/db/package.json'));
  const candidates = [
    join(dbPackageRoot, 'migrations'),
    join(process.cwd(), 'packages', 'db', 'migrations'),
    join(process.cwd(), '..', '..', 'packages', 'db', 'migrations'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(`Database migrations folder was not found. Checked: ${candidates.join(', ')}`);
}
