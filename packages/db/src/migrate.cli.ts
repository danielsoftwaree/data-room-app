import { createDatabase } from './client';
import { DEFAULT_DATABASE_URL } from './constants';
import { runMigrations } from './migrate';

const DEFAULT_MIGRATION_POOL_MAX = 1;

async function main(): Promise<void> {
  const { db, pool } = createDatabase({
    url: process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL,
    poolMax: getPoolMax(),
  });

  try {
    await runMigrations(db);
    console.log('Database migrations completed');
  } finally {
    await pool.end();
  }
}

function getPoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX?.trim();
  if (!raw) return DEFAULT_MIGRATION_POOL_MAX;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('DATABASE_POOL_MAX must be a positive integer');
  }

  return value;
}

void main();
