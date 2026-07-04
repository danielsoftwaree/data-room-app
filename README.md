# Data Room MVP

A virtual **Data Room** — a secure repository for organizing due-diligence
documents into a data room → folders → PDF files hierarchy. Built as a
production-shaped monorepo, take-home style.

## Quick start (zero config)

```bash
bun install
bun run dev
```

Open http://localhost:5173. The web app runs against an in-browser mock API
(MSW) by default, so **no database or backend is required** to click through the
whole product. The mock is stateful and persists to IndexedDB, so uploads and
edits survive a page reload.

First screen empty? Use **Create sample data room** to load a realistic Acme
due-diligence structure (Corporate / Financials / Legal / HR with nested folders
and openable PDFs).

To run against the real NestJS + PostgreSQL backend instead, see
[Running the real backend](#running-the-real-backend).

## Stack

Bun workspaces + Turborepo. React 19 + TypeScript + Vite + Tailwind v4 +
shadcn/ui (`apps/web`), NestJS 11 (`apps/api`), PostgreSQL + Drizzle ORM, and a
generated, type-safe API client (OpenAPI → Orval → TanStack Query). Shared
packages for domain, contracts, ui and config.

## Layout

```
apps/web      React SPA (the product)
apps/api      NestJS API (Postgres-backed datarooms, folders, PDF files)
packages/     contracts | db | domain | ui | config | api-client
tooling/      typescript-config | lint-config | format-config | tailwind-config
tests/e2e     root Playwright workspace (@repo/e2e)
docs/         architecture.md | monorepo.md | deploy.md
```

See `docs/monorepo.md` for the dependency rules, `docs/architecture.md` for
design decisions, and `PLAN.md` / `SPEC.md` for the product plan and scope.

## Features

Everything in the UI is wired to a real operation — there are no placeholder or
dead controls.

- **Data rooms**: create, rename, delete (cascades to all contents), list.
- **Folders**: create, nest to any depth, rename, delete with a confirmation
  that counts the subtree ("N folder(s) and M file(s)").
- **Files (PDF only)**: upload via button or drag-and-drop, multi-file at once,
  in-app PDF viewer, rename, delete.
- **Workspace actions**: move folders/files with duplicate-name auto-suffixing,
  multi-select rows, bulk delete, favorites, members, activity, owner
  attribution, and storage usage.
- **Navigation**: breadcrumbs, folder drill-in, and URL-as-state — the current
  data room, folder, and search term all live in the URL, so refresh, deep-link
  and back/forward all work.
- **Search**: case-insensitive name search within a data room (term kept in
  `?q=`), flat results that show each hit's folder path and link into it.
- **Polish**: empty states with CTAs, loading skeletons, toasts on every
  mutation, row context menus, "folders first, then alphabetical" sorting,
  and a light/dark theme toggle (persisted, no flash on load).

## Design decisions

### Data model — adjacency list

One `nodes` table models the folder tree as an adjacency list (`parentId`, with
`null` = data-room root). Folders and files are the same row shape; a file adds
`size`; datarooms and nodes also carry `createdBy` / `updatedBy` attribution.
This keeps arbitrary nesting trivial, makes cascade delete a subtree walk
(`collectSubtreeIds`), and maps cleanly onto Postgres. Name uniqueness within a
folder is enforced two ways: readable 409s in the service, plus **partial unique
indexes** in the schema (one for root-level siblings where `parentId IS NULL`,
one for nested siblings) as a race-condition backstop.

The rules that define behavior — name validation, case-insensitive duplicate
detection, `file (1).pdf` auto-suffixing, sort order, subtree collection — live
as pure functions in `@repo/domain` with **no React/Nest/browser dependencies**.
That's what lets the exact same rules run in the API, in the MSW mock, and on the
client for instant inline validation.

### Frontend

- **URL is the state.** Routes (`/`, `/datarooms/:id`, `/datarooms/:id/folders/:folderId`)
  derive everything from their params; the current folder is never held in
  component state, so refresh and deep-links can't desync.
- **Three-panel workspace.** The product shell has an app sidebar, the document
  workspace, and a detail panel. The layout follows the reference structure but
  keeps the existing Tailwind/shadcn tokens and Discord-inspired theme.
- **Demo identity without auth.** `x-user-id` comes from the selected demo user
  in localStorage, so ownership, favorites, members and activity are real data
  flows without adding a login wall.
- **Dual-mode by construction.** The generated API client is the single seam.
  In dev it hits MSW handlers that reuse `@repo/domain`; in real mode the same
  calls hit Nest. The "Create sample data room" flow is just an orchestration of
  the ordinary create/upload endpoints, so it works identically in both modes.
- **Errors surface where they belong.** Form conflicts (duplicate names) render
  inline in the dialog; batch/background failures (per-file upload results) use
  toasts that list each failed file and why. The client mirrors `@repo/domain`
  validation so most errors are caught before a request is sent, with the server
  as the backstop.

### Backend

- Files are uploaded to the API, not kept in browser memory. Metadata lives in
  `nodes`; bytes live behind a `BlobStorage` abstraction
  (`apps/api/src/modules/storage`): `STORAGE_DRIVER=db` stores them in
  `file_blobs` (`bytea`, zero-setup local default), `STORAGE_DRIVER=s3` targets
  any S3-compatible bucket via the AWS SDK. Folder listings never load blob
  content. On a blob-write failure the metadata row is compensatingly deleted.
- Users, members, favorites, activity and storage usage live in the workspace
  module. Unknown `x-user-id` values fall back to the default demo user, keeping
  local and mock mode frictionless while still exercising attribution paths.
- PDF-only is enforced by MIME, `.pdf` extension **and** the `%PDF-` signature.
  The shared 50 MB limit rejects gigabyte uploads with a 413.
- Every error is shaped by a global exception filter into the
  `{ error: { code, message } }` contract; unknown errors become an opaque 500.
  `helmet`, a CORS allowlist (`CORS_ORIGIN`) and a per-IP rate limit
  (100 req/min) guard the HTTP surface. Non-ASCII filenames are served safely via
  an RFC 5987 `Content-Disposition`.

## Edge cases handled

Duplicate names (auto-suffix on upload, inline conflict on rename,
case-insensitive); empty/whitespace/over-length/illegal-character names;
non-PDF and oversized uploads with a per-file reason; deleting a non-empty
folder (warned with a real content count); partial failures in a multi-file
upload (successes kept, failures listed); move into self or descendants blocked;
refresh/deep-link/back-forward mid-navigation; double-submit guards on pending
mutations.

## Tests

`bun run test` runs `bun test` across: pure `@repo/domain` rules, the datarooms
service over in-memory fakes, the exception filter, and an **HTTP integration
suite that boots the real Nest app** (controllers, validation, multipart) with
only the database/storage swapped for fakes — no running PostgreSQL required.
Cross-app Playwright smoke tests live in `tests/e2e` and run only via
`bun run test:e2e` (not part of the fast default loop).

## Running the real backend

The API needs a PostgreSQL to point `DATABASE_URL` at (any local install, or
`docker compose up -d`). Apply committed Drizzle migrations, then run the dev
stack with mocks disabled:

```bash
bun run --cwd packages/db db:migrate
bun run dev:real   # web with VITE_ENABLE_MOCKS=false, api on :3000
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

On a fresh docker volume, compose also creates `dataroom_e2e` for Playwright. If
you already had the Postgres volume before this script existed, create that
database manually or recreate the local volume, then rerun `bun run test:e2e`.

## Other commands

```bash
bun run build      # full ordered build via turbo
bun run typecheck
bun run lint
bun run format
bun run generate   # regenerate the API client from the OpenAPI schema
```

## AI-assisted workflow

This project was designed and built with an AI coding agent as the primary
tool, which the take-home explicitly allows. The workflow: the agent scoped the
task against the brief (`PLAN.md`, `SPEC.md`), then built vertically —
domain rules first, then the API, the generated client, and the UI — keeping
`build`/`typecheck`/`lint`/`test` green at each step. It also ran a full
evaluator-style click-through in a real browser (create → nest → upload → view →
rename → delete, plus the break-it cases) to catch UX gaps the type checker
can't.

## Out of scope (deliberate trade-offs)

- **Authentication.** Extra-credit in the brief; left out to keep the app
  zero-friction "works out of the box" rather than gating it behind a login. The
  app uses selectable demo users plus `x-user-id` for attribution instead.
- **Cloud blob storage for local dev.** Blobs default to Postgres `bytea`;
  `STORAGE_DRIVER=s3` is ready for production. Production-scale large uploads
  should move to presigned URLs straight into the bucket.
- **Non-PDF formats, content search, drag-and-drop reparenting, real
  sharing/permissions, versioning, realtime multi-user.** All out of the MVP
  scope defined in `SPEC.md`.

## Deploy (Railway)

Everything is designed to run on Railway: web, api, PostgreSQL and an
S3-compatible bucket. Build/deploy commands are committed as config-as-code
(`apps/api/railway.json`, `apps/web/railway.json`); the full topology, variables
and smoke checklist are in `docs/deploy.md`. A live URL is pending provisioning.
