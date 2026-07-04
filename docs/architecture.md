# Architecture

See `PLAN.md` for the product plan (what we build and why) and `docs/monorepo.md`
for the workspace layout.

## High-level

- `apps/web` - React SPA, owns all Data Room UX. Server state comes exclusively
  from the generated `@repo/api-client` hooks (TanStack Query); no hand-written
  fetch calls.
- `apps/api` - NestJS API: real CRUD for datarooms/nodes over an in-memory store
  shaped like a repository; business rules delegated to `@repo/domain`. Emits the
  OpenAPI schema that the client is generated from.
- `@repo/domain` - the model: `Dataroom`, `DataroomNode` (folder/file, adjacency list
  via `parentId`), naming rules, duplicate-name resolution, subtree collection for
  cascade delete, listing order.
- `@repo/contracts` - authored DTO interfaces shared across the HTTP boundary;
  api DTO classes implement them.
- `@repo/api-client` - generated (Orval) typed client + react-query hooks;
  never edited by hand.
- `@repo/ui` - design-system primitives, business-logic free.
- `@repo/config` - truly global constants (upload limits, accepted types, API prefix).

## Vertical feature modules

Both apps group code by feature (vertical slice), not by technical kind.

### apps/api

    src/
      main.ts             bootstrap (HTTP)
      openapi.ts          bootstrap (schema emit, no listener)
      swagger.ts          shared OpenAPI document builder
      app.module.ts       composition root: imports feature modules
      modules/
        health/           feature: liveness (controller + dto)
        datarooms/        feature: datarooms + nodes CRUD
                          (module, controllers, service, dto)

A Nest feature module owns its controllers, service and DTOs. New capability =
new directory under `src/modules/`, wired into `app.module.ts`.

### apps/web

    src/
      main.tsx            entry: mounts providers + shell
      app/                application shell: providers, App (routing later)
      features/           vertical feature modules (see src/features/README.md)
        datarooms/        first feature: list/create screen (smoke screen for now)
      shared/             feature-agnostic utils (see src/shared/README.md)

Import direction: `app` -> `features` -> `shared` -> `@repo/*`. Features expose a
single public entry (`index.ts`); cross-feature imports go through it.

## Key decisions

1. **Adjacency list for the tree** (`parentId: string | null`): simplest model that
   supports nesting, renames and cascade deletes; subtree operations are provided by
   `@repo/domain` helpers.
2. **Domain logic lives outside React**: name validation and conflict resolution are
   pure functions - unit-testable, reusable by web and api.
3. **Generated contract, not copy-paste**: api swagger annotations produce
   `openapi.json`; Orval generates the typed client and hooks. Web and api cannot
   drift silently.
4. **Vertical feature modules in both apps**: code is grouped by capability, so a
   feature can be added, understood and deleted as one unit.
5. **Tooling as workspace packages**: one source of truth for TS/lint/format settings.
