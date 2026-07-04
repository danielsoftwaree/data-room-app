# Architecture

See `PLAN.md` for the product plan (what we build and why) and `docs/monorepo.md`
for the workspace layout.

## High-level

- `apps/web` - React SPA, owns all Data Room UX. Talks to storage through a
  repository layer; server interaction goes only through `@repo/contracts` types
  and the HTTP boundary.
- `apps/api` - NestJS API. Thin by design: the take-home allows a mocked backend,
  so the API stays a health/contract surface until a real backend is required.
- `@repo/domain` - the model: `Dataroom`, `DataroomNode` (folder/file, adjacency list
  via `parentId`), naming rules, duplicate-name resolution, subtree collection for
  cascade delete, listing order.
- `@repo/contracts` - DTOs shared across the HTTP boundary.
- `@repo/ui` - design-system primitives, business-logic free.
- `@repo/config` - truly global constants (upload limits, accepted types, API prefix).

## Key decisions

1. **Adjacency list for the tree** (`parentId: string | null`): simplest model that
   supports nesting, renames and cascade deletes; subtree operations are provided by
   `@repo/domain` helpers.
2. **Domain logic lives outside React**: name validation and conflict resolution are
   pure functions - unit-testable, reusable by web and api.
3. **Contracts as a package, not copy-paste**: web and api can never drift apart on DTO
   shapes silently.
4. **Tooling as workspace packages**: one source of truth for TS/lint/format settings.
