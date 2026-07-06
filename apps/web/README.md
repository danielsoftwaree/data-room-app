# apps/web — frontend architecture

The rules below are the contract for every change in this app. Directory-level
details live in [`src/features/README.md`](src/features/README.md) and
[`src/shared/README.md`](src/shared/README.md); workspace-level rules in
[`docs/monorepo.md`](../../docs/monorepo.md). When code and this document
disagree, fix one of them in the same PR.

## Layer map

    src/main.tsx     bootstrap: global CSS, dev mocks gate, mount <App/>
    src/app/         composition root: router mount, providers, app-level wiring hooks
    src/routes/      TanStack Router file routes — thin: parse params/search, render a feature screen
    src/features/    vertical feature modules, one per user-facing capability
    src/shared/      cross-feature building blocks (components / hooks / lib / store)
    src/mocks/       dev-only MSW mock API; reachable from main.tsx only

## Import rules

Dependency direction is one-way: `app → routes → features → shared → @repo/*`.

| From         | May import                                                                 | Never imports            |
| ------------ | -------------------------------------------------------------------------- | ------------------------ |
| `app/`       | features (via `index.ts`), shared, `@/routeTree.gen`                       | routes, mocks            |
| `routes/`    | features (via `index.ts`), shared                                          | app, other routes, mocks |
| `features/*` | `@repo/*`, shared, own files, **other features only via their `index.ts`** | app, routes, mocks       |
| `shared/`    | `@repo/*`, other shared files                                              | features, app, routes    |
| `mocks/`     | `@repo/*`, `shared/lib`                                                    | features, app, routes    |

Path style: use the `@/` alias (`@/features/...`, `@/shared/...`) whenever an
import crosses one of the top-level areas above; use relative paths inside one
area or feature. Keep the cross-feature graph acyclic — if two features need
each other, the shared part moves down (to `shared/` or `@repo/domain`).

## Where does a new file go?

| You are adding                                                               | Home                                                                                          |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A new screen / user-facing capability                                        | `features/<name>/` with a public `index.ts`                                                   |
| A component, hook, or helper used by ONE feature                             | inside that feature (`components/` `hooks/` `helpers/`)                                       |
| A component or hook used by 2+ features                                      | `shared/components/` or `shared/hooks/`                                                       |
| A domain-specific helper used by one feature (even a "reusable-looking" one) | that feature's `helpers/` — promote to `shared/` only when a second feature actually needs it |
| A fully generic utility or third-party integration (no domain types)         | `shared/lib/` or `shared/hooks/`                                                              |
| A global client-side UI preference                                           | extend `shared/store/ui-store.ts` — no parallel stores                                        |
| A business rule (naming, duplicates, cascade, sorting)                       | NOT here → `@repo/domain`                                                                     |
| A web↔api contract type                                                      | NOT here → `@repo/contracts`                                                                  |
| A business-agnostic visual primitive                                         | NOT here → `packages/ui`                                                                      |
| A page URL                                                                   | `routes/` (thin route file)                                                                   |
| An app-wide provider or wiring hook                                          | `app/`                                                                                        |

## State management

- **Server state** — generated TanStack Query hooks from `@repo/api-client`
  only, wrapped in feature hooks (`use-*.query.ts` / `use-*.mutation.ts` own
  cache invalidation and toasts). Never hand-written `fetch`.
- **Global UI preferences** (theme, list/grid view) — the persisted zustand
  store `shared/store/ui-store.ts`. Extend it; do not add another store.
- **Screen-local state** (selection, dialogs, filters) — React state inside
  feature hooks (`use-<thing>.ts`); screens compose hooks and stay declarative.
  Shareable state (search, deep links) goes in URL search params instead.
- **No direct `useEffect` in components** — derive during render, do work in
  event handlers, reset with `key` on navigation. Raw effects are allowed only
  inside reusable hooks (`shared/hooks/`, `app/use-auth-token-bridge.ts`).

## Verification before merging

1. `bun run typecheck && bun run lint && bun run format`
2. Every fetch site renders all four states: loading, error, empty, success.
3. Destructive actions confirm with an impact summary.
4. Check the change in the browser at desktop and mobile widths
   (`bun run dev`, mock API is on by default).
