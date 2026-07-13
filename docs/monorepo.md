# Monorepo

Bun workspaces + Turborepo. This document is the rulebook: what lives where,
which imports are allowed, and how builds are ordered. If a rule here and the
code disagree, fix one of them in the same PR - do not let them drift.

## Layout

```
apps/       runnable applications only (nothing imports them)
packages/   reusable internal libraries (@repo/*)
tooling/    shared configs, versioned as workspace packages
tests/      root test workspaces, currently @repo/e2e
docs/       living documentation (see "Keeping order" below)
tasks/      work items: tasks/<id>-<slug>/PLAN.md per task
```

## Ownership

- **apps** run the product. `apps/web` (React SPA) and `apps/api` (NestJS) are
  entrypoints; nothing imports from them.
- **packages** hold reusable logic and never import from `apps/*`.
- **tooling** keeps quality identical everywhere: TS/lint/format/tailwind
  configs are workspace packages (`@repo/typescript-config`, ...), not
  copy-pasted dotfiles.
- **tests** holds cross-app suites such as `@repo/e2e`. App-local integration
  tests stay in the owning app, for example `apps/api/tests/integration`.

## Dependency direction

```
apps/web ──> @repo/api-client ──> (generated from apps/api's openapi.json)
apps/web ──> @repo/ui, @repo/domain, @repo/contracts, @repo/config
apps/api ──> @repo/db, @repo/domain, @repo/contracts, @repo/config
@repo/contracts ──> @repo/domain
@repo/domain    ──> nothing app-specific (pure TS)
@repo/db        ──> drizzle/pg only; no Nest, no apps
```

Forbidden:

- `packages/* -> apps/*` (any direction into apps)
- `apps/web -> apps/api` source imports - the only boundary between them is
  HTTP + `@repo/contracts` + the generated client
- `@repo/ui -> web modules` (the design system knows nothing about features)
- hand edits to generated code (`@repo/api-client/src/generated`,
  `apps/web/src/routeTree.gen.ts`, `apps/api/openapi.json`)

`@repo/domain` stays the cleanest package: pure types + business rules, no
React, Nest, browser APIs or storage. `@repo/db` owns the PostgreSQL schema,
Drizzle version, pg client factory and migrations; API-specific DI and request
handling stay in `apps/api`.

## Build model

- `@repo/domain`, `@repo/contracts`, `@repo/config`, `@repo/db` are compiled
  libraries (tsc -> `dist/`); the Nest build consumes their `.d.ts`. Turbo
  orders builds via `dependsOn: ["^build"]`, and `typecheck` depends on
  `^build` for the same reason.
- `@repo/ui` is a just-in-time package: it exports TSX source, bundled by the
  consuming app (Vite). Tailwind v4 scans its sources via `@source` in
  `src/styles/globals.css`; components are imported via subpath exports
  (`@repo/ui/components/*`).
- The contract chain is explicit in `turbo.json`:
  `api#build -> api#openapi -> @repo/api-client#generate -> web#build`.

## Commands

```bash
bun install
bun run dev          # web :5173 (+ /api proxy) and api :3000
bun run test         # domain rules, api service + filter, HTTP integration (no Postgres)
bun run build        # full ordered build via the turbo graph
bun run typecheck
bun run lint
bun run format
bun run --cwd packages/db db:generate   # new migration from schema changes
bun run --cwd packages/db db:migrate    # apply migrations
```

## Keeping order

Rules that keep the repo navigable as it grows:

1. **Docs describe reality.** `docs/` documents what exists today. Aspirations
   and refactoring plans go to `tasks/<id>-<slug>/PLAN.md`; a doc may link to a
   task, but must not present the target state as current.
2. **One task, one folder.** Every non-trivial change starts as a numbered
   task folder with a `PLAN.md` (scope, steps, acceptance criteria). Done tasks
   keep their folder as a decision record.
3. **Feature code stays in its slice.** New api capability = directory under
   `apps/api/src/modules/`; new web capability = directory under
   `apps/web/src/features/` with a single `index.ts` entry.
4. **Generated files are never edited** - regenerate them (`routeTree.gen.ts`,
   `@repo/api-client/src/generated`, `apps/api/openapi.json`).
5. **Reference material is quarantined.** Example/reference code brought in
   for discussion (like `env_example/`) must not be imported by app code and
   is deleted once the real implementation lands.
6. **No placeholder features.** UI without a working backend path (or mock)
   does not ship - the assignment's "no unimplemented features" rule applies
   repo-wide.

Doc map: `docs/architecture.md` (components and decisions),
`docs/monorepo.md` (this file),
`docs/design-system/` (design notes), `README.md` (setup and deploy).
