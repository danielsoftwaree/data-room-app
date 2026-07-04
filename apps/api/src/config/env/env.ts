const DEFAULT_DATABASE_URL = 'postgres://dataroom:dataroom@localhost:5432/dataroom';
const DEFAULT_DATABASE_POOL_MAX = 10;

export function getDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (raw) return raw;
  if (isProduction()) {
    throw new Error('DATABASE_URL must be set in production');
  }
  return DEFAULT_DATABASE_URL;
}

export function getDatabasePoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX?.trim();
  if (!raw) return DEFAULT_DATABASE_POOL_MAX;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_DATABASE_POOL_MAX;
  return parsed;
}

export type StorageDriver = 'db' | 's3';

export function getStorageDriver(): StorageDriver {
  const raw = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (!raw || raw === 'db') return 'db';
  if (raw === 's3') return 's3';
  throw new Error(`Invalid STORAGE_DRIVER "${raw}" (expected "db" or "s3")`);
}

export interface S3Config {
  endpoint: string | undefined;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function getS3Config(): S3Config {
  return {
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    region: process.env.S3_REGION?.trim() || 'auto',
    bucket: requireEnv('S3_BUCKET'),
    accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
  };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be set when STORAGE_DRIVER=s3`);
  return value;
}

function isProduction(): boolean {
  return process.env.NODE_ENV?.trim() === 'production';
}
