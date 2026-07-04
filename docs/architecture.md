# Architecture

What runs where, who owns what, and the decisions behind it.
Companion docs: `docs/monorepo.md` (workspace layout and rules),
`PLAN.md` (product plan), `tasks/` (active work items).

## The system in one paragraph

A virtual Data Room: users create datarooms, nest folders, upload and view PDF
files. `apps/web` is a React SPA; `apps/api` is a NestJS service over PostgreSQL.
The API publishes an OpenAPI schema; the typed client and react-query hooks in
`@repo/api-client` are generated from it, so web and api cannot drift silently.
Business rules (naming, duplicates, tree traversal) are pure functions in
`@repo/domain`, shared by both sides.

## Components

| Unit               | Role                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web`         | React 19 SPA. TanStack Router (file-based routes), TanStack Query for server state, Tailwind v4 + `@repo/ui` for the UI.                                                             |
| `apps/api`         | NestJS 11. CRUD for datarooms/nodes/files over PostgreSQL + Drizzle. Emits `openapi.json`.                                                                                           |
| `@repo/domain`     | The model: `Dataroom`, `DataroomNode` (folder/file, adjacency list via `parentId`), name validation, duplicate resolution, subtree collection, listing order. Pure TS, no framework. |
| `@repo/contracts`  | Hand-authored request/response interfaces shared across the HTTP boundary; api DTO classes implement them.                                                                           |
| `@repo/db`         | PostgreSQL schema (Drizzle), committed migrations, `Database` type. Storage infrastructure, not a Nest module.                                                                       |
| `@repo/api-client` | Generated (Orval) typed client + react-query hooks. Never edited by hand.                                                                                                            |
| `@repo/ui`         | Design system: vendored shadcn/ui components on Tailwind v4, business-logic free.                                                                                                    |
| `@repo/config`     | Truly global constants: API prefix, upload limits, accepted types.                                                                                                                   |
| `@repo/e2e`        | Root workspace for cross-app e2e specs under `tests/e2e`; app-local integration tests stay in the owning app.                                                                        |

## apps/api

```
src/
  main.ts             bootstrap: helmet, CORS allowlist, validation pipe,
                      exception filter, starts HTTP
  openapi.ts          emits openapi.json without starting a listener
  swagger.ts          shared OpenAPI document builder
  app.module.ts       composition root: throttler + feature modules
  config/
    database/         Nest DB module: pg pool + drizzle instance from @repo/db
    env/              zod-validated environment config with safe dev defaults
  modules/
    health/           GET /api/health (static liveness)
    datarooms/        datarooms + nodes CRUD as a DDD-light module:
                      domain ports/errors/value objects, application services,
                      Drizzle adapter, HTTP controllers/DTOs/error mapping
    storage/          BlobStorage abstraction: db (bytea) or s3 driver,
                      selected by STORAGE_DRIVER
  shared/             exception filter, error helpers, small utilities
tests/
  integration/        HTTP integration suite over in-memory fakes (no Postgres needed)
```

Layering inside a feature mirrors the module's size. Simple features can stay
controller -> service -> repository. Richer features, like `datarooms`, use a
DDD-light shape: `http -> application -> domain <- infrastructure`. The
`domain/` folder is pure TypeScript, `application/` orchestrates use cases over
ports and shared `@repo/domain` rules, `infrastructure/` implements adapters,
and `http/` owns DTOs/controllers/error translation. This is intentionally not
aggregates/CQRS; it is just enough layering to keep persistence and transport
out of use-case code.

Adding a capability = new directory under `src/modules/`, wired into
`app.module.ts`.

File bytes never live in `nodes`: metadata is a row, content goes through
`BlobStorage` (`file_blobs` bytea locally, any S3-compatible bucket in
production). Uploads are PDF-only, checked three ways (MIME, extension,
`%PDF-` signature) and capped by the shared `UPLOAD.maxFileSizeBytes`.

Name search is a filter on the existing node listing:
`GET /datarooms/:id/nodes?search=<term>` applies a case-insensitive substring
match in PostgreSQL and returns the same flat node shape. The web route stores
the UI term as `?q=` and renders matching files/folders as a flat list with
client-computed folder locations from the full node list.

## apps/web

```
src/
  main.tsx            entry: enables dev mocks, mounts providers + app
  app/                shell: providers (query client, router), App
  routes/             TanStack Router file-based routes
                      (routeTree.gen.ts is generated - do not edit)
  features/           vertical feature modules (see src/features/README.md)
    datarooms/        dataroom list: screen, rows, hooks
    dataroom-browser/ folder tree browsing, breadcrumbs, PDF viewer
    design-system/    internal showcase of tokens and components
  mocks/              dev-only MSW mock API with IndexedDB persistence
                      (enable.ts is a no-op in production builds)
  shared/             feature-agnostic utils (see src/shared/README.md)
```

Import direction: `app` -> `features` -> `shared` -> `@repo/*`. Each feature
exposes one public entry (`index.ts`); cross-feature imports go through it.
Server state comes only from `@repo/api-client` hooks - feature hooks may wrap
them, never re-implement fetching.

## Decisions

1. **Adjacency list for the tree** (`parentId: string | null`) - the simplest
   model that supports nesting, renames and cascade deletes. Subtree operations
   live in `@repo/domain`; the database enforces integrity with cascading FKs
   and case-insensitive unique names per level (partial unique indexes on
   `lower(name)`).
2. **Domain logic outside frameworks** - validation and conflict resolution are
   pure functions: unit-testable, reused by web (instant feedback) and api
   (authority).
3. **Generated contract, not copy-paste** - swagger annotations produce
   `openapi.json`; Orval generates the client. The turbo graph orders it:
   `api#build` -> `api#openapi` -> `@repo/api-client#generate` -> `web#build`.
4. **Vertical feature modules in both apps** - code is grouped by capability,
   so a feature can be added, understood and deleted as one unit.
5. **One error shape** - a global exception filter maps every error to
   `{ error: { code, message } }`; unknown errors become an opaque 500 and are
   logged, never leaked.
6. **shadcn components are vendored, not installed** - the CLI writes sources
   into `packages/ui/src/components`; components are owned and themed via
   shared tokens in `tooling/tailwind-config/theme.css`.
7. **OpenAPI generation stays offline** - migrations are an explicit
   `packages/db` command, not part of API bootstrap, so `bun run generate`
   needs no database.
8. **Dev mock API in the browser** - MSW + IndexedDB give the web app a full
   offline dev mode; production builds never ship the mock code.
9. **Auth is out of scope for the MVP** - no auth code, and Clerk dependencies
   are intentionally not installed. `docs/auth-clerk.md` is a forward-looking
   sketch of how it would be added (including an `owner_id` seam).
10. **DDD-light inside modules when complexity warrants it** - module-local
    `domain/application/infrastructure/http` folders are used for `datarooms`
    because it owns tree operations, file upload policy, persistence ports and
    HTTP error mapping. API-only ports/value objects stay module-local; shared
    business rules remain in `@repo/domain`.

## Known debt

Tracked honestly instead of papered over; each item links to its task.

- **Repository operations are not transactional** across metadata and blob
  storage. The current service compensates by deleting a metadata row when blob
  writes fail; revisit when write workflows need multi-step atomicity.
- **Downloads buffer whole files in memory** (bounded by the 50 MB upload
  limit). Streaming from S3 is the production follow-up.
