import { defineConfig } from 'drizzle-kit';

const DEFAULT_DATABASE_URL = 'postgres://dataroom:dataroom@localhost:5432/dataroom';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  },
});
