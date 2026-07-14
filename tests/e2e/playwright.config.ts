import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// webServer commands use repo-root-relative paths; Playwright's default cwd
// is this config's directory, so pin it explicitly.
const repoRoot = path.resolve(__dirname, '../..');

const webBaseUrl = process.env.E2E_WEB_BASE_URL ?? 'http://localhost:5173';
const apiBaseUrl = process.env.E2E_API_BASE_URL ?? 'http://localhost:3000/api';
const databaseUrl =
  process.env.E2E_DATABASE_URL ?? 'postgres://dataroom:dataroom@localhost:5432/dataroom_e2e';

export default defineConfig({
  testDir: './specs',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: webBaseUrl,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'bun run --cwd packages/db db:migrate && bun run --cwd apps/api start',
      cwd: repoRoot,
      url: `${apiBaseUrl}/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: databaseUrl,
        STORAGE_DRIVER: 'db',
        CORS_ORIGIN: webBaseUrl,
        PORT: '3000',
      },
    },
    {
      command: 'bun run --cwd apps/web dev -- --host localhost --strictPort',
      cwd: repoRoot,
      url: webBaseUrl,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        VITE_ENABLE_MOCKS: 'false',
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
