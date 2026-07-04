# Data Room MVP

Take-home project: a virtual Data Room (secure document repository) built as a
production-shaped monorepo.

## Stack

Bun workspaces + Turborepo. React 19 + TypeScript + Vite (`apps/web`),
NestJS (`apps/api`), PostgreSQL + Drizzle ORM, shared packages for domain,
contracts, ui and config.

## Layout

```
apps/web      React SPA (the product)
apps/api      NestJS API (Postgres-backed datarooms, folders, PDF files)
packages/     contracts | db | domain | ui | config
tooling/      typescript-config | lint-config | format-config | tailwind-config
tests/e2e     root e2e workspace (@repo/e2e)
docs/         architecture.md | monorepo.md
```

See `docs/monorepo.md` for the dependency rules and `docs/architecture.md` for design
decisions. `PLAN.md` holds the product plan.

## Setup

```bash
bun install
```

The API needs a PostgreSQL to point `DATABASE_URL` at (any local install or
`docker compose up -d` if you prefer docker). Apply committed Drizzle migrations
before starting the API:

```bash
bun run --cwd packages/db db:migrate
```

## Development

```bash
bun run dev        # web on :5173 (+ /api proxy), api on :3000
bun run dev:real   # same dev stack with VITE_ENABLE_MOCKS=false
bun run test       # bun test via turbo (domain, service, filter, HTTP integration)
bun run test:e2e   # Playwright smoke against web + real API + Postgres
bun run --cwd packages/db db:generate
bun run --cwd packages/db db:migrate  # apply committed DB migrations
bun run build      # full ordered build via turbo
bun run typecheck
bun run lint
bun run format
```

The API uses `DATABASE_URL` when set; otherwise it falls back to the local dev
database `postgres://dataroom:dataroom@localhost:5432/dataroom` (dev only — in
production `DATABASE_URL` is required). See `.env.example` for all knobs.

For real-mode E2E, use a dedicated database:

```bash
docker compose up -d
bunx playwright install chromium
bun run test:e2e
```

On a fresh docker volume, compose also creates `dataroom_e2e` for Playwright.
If you already had the Postgres volume before this script existed, create that
database manually or recreate the local volume, then rerun `bun run test:e2e`.

## Backend decisions

- Files are uploaded to the API, not kept in browser memory. Metadata lives in
  `nodes`; file bytes live behind a `BlobStorage` abstraction
  (`apps/api/src/modules/storage`): `STORAGE_DRIVER=db` stores them in
  `file_blobs` (`bytea`, zero-setup local default), `STORAGE_DRIVER=s3` targets
  any S3-compatible bucket (Railway) via the AWS SDK. Folder listings never load
  blob content either way.
- MVP accepts only PDF: MIME, `.pdf` extension and `%PDF-` signature are checked. The
  shared upload limit is 50 MB; gigabyte uploads are intentionally rejected with 413.
- Every error is shaped by a global exception filter into the
  `{ error: { code, message } }` contract; unknown errors become an opaque 500.
  helmet, a CORS origin allowlist (`CORS_ORIGIN`) and a per-IP rate limit
  (100 req/min) guard the HTTP surface.
- Tests run with `bun test`: pure domain rules, the service over in-memory fakes,
  the exception filter, and an HTTP integration suite that boots the real Nest app
  (controllers, validation, multipart) with only the database/storage swapped for
  fakes - no running PostgreSQL required.
- Cross-app Playwright smoke tests live in `tests/e2e` and run only through
  `bun run test:e2e`; they are intentionally not part of the fast default
  `bun run test` loop.
- `GET /datarooms/:id/nodes?search=<term>` performs case-insensitive
  name-based filtering for files and folders. The browser keeps the term in
  `?q=` and renders flat results with their folder location.
- Production-scale large uploads should move to presigned URLs straight into the
  bucket, plus auth-bound ownership (`owner_id`) when Clerk is enabled.

## Deploy (Railway)

Everything runs on Railway: web, api, PostgreSQL and an S3-compatible bucket.
The repo-side configuration and required service settings are documented in
`docs/deploy.md`. A live URL is still pending because this environment has no
Railway CLI/authenticated project context.
