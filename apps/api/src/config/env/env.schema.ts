import { DEFAULT_DATABASE_URL } from '@repo/db';
import { z } from 'zod';

const DEFAULT_DEV_CORS_ORIGINS = ['http://localhost:5173', 'http://localhost:4173'];

const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
  z.string().trim().optional(),
);

const envSchemaBase = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: optionalTrimmedString,
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  CORS_ORIGIN: optionalTrimmedString.transform((value) =>
    value
      ? value
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0)
      : undefined,
  ),
  STORAGE_DRIVER: z.enum(['db', 's3']).default('db'),
  S3_ENDPOINT: optionalTrimmedString,
  S3_REGION: optionalTrimmedString.default('auto'),
  S3_BUCKET: optionalTrimmedString,
  S3_ACCESS_KEY_ID: optionalTrimmedString,
  S3_SECRET_ACCESS_KEY: optionalTrimmedString,
  CLERK_SECRET_KEY: optionalTrimmedString,
});

export const envSchema = envSchemaBase
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'production') {
      if (!env.DATABASE_URL) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DATABASE_URL'],
          message: 'DATABASE_URL must be set in production',
        });
      }

      if (!env.CORS_ORIGIN || env.CORS_ORIGIN.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGIN'],
          message: 'CORS_ORIGIN must be set in production',
        });
      }
    }

    if (env.NODE_ENV === 'production' && !env.CLERK_SECRET_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CLERK_SECRET_KEY'],
        message: 'CLERK_SECRET_KEY must be set in production',
      });
    }

    if (env.STORAGE_DRIVER === 's3') {
      for (const key of ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
        if (!env[key]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} must be set when STORAGE_DRIVER=s3`,
          });
        }
      }
    }
  })
  .transform((env) => ({
    ...env,
    DATABASE_URL: env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    CORS_ORIGIN: env.CORS_ORIGIN ?? DEFAULT_DEV_CORS_ORIGINS,
  }));

export type Env = z.infer<typeof envSchema>;

export function parseEnv(environment: unknown): Env {
  return envSchema.parse(environment);
}
