import { defineConfig } from 'drizzle-kit';
import { DEFAULT_DATABASE_URL } from './src/constants';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  },
});
