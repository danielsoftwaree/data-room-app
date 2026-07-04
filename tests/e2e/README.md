# E2E tests

Cross-app Playwright smoke tests for the web SPA against the real Nest API.

Run from the repo root:

```bash
docker compose up -d
bunx playwright install chromium
bun run test:e2e
```

The Playwright config starts:

- API on `http://localhost:3000` with `DATABASE_URL` set to `E2E_DATABASE_URL`
  or `postgres://dataroom:dataroom@localhost:5432/dataroom_e2e`.
- Web on `http://localhost:5173` with `VITE_ENABLE_MOCKS=false`.

Each spec creates uniquely named data rooms and deletes them through the API in
cleanup. App-local integration tests stay in the owning app, for example
`apps/api/tests/integration`.
