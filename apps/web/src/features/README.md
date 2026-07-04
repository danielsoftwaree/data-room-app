# features/

Vertical feature modules. One directory per user-facing capability
(`datarooms`, `dataroom-browser`, ...).

## Layout

    features/<name>/
      index.ts          <- public entry; the ONLY import path for outsiders
      components/       <- feature UI (one component per file)
      hooks/            <- feature-specific hooks (wrapping @repo/api-client)
      helpers/          <- pure feature-local helpers (no React, no I/O)

Create subdirectories only when needed: a small feature can start with just
`index.ts` and `components/`.

Route files stay in `src/routes/` (TanStack Router scans that directory).
Keep them thin: parse params, render the screen imported from the feature's
`index.ts` - no logic in route files.

## File conventions

- **kebab-case file names** everywhere: `repository-commit-history.tsx`,
  `format-tree-entry-size.ts`.
- **components/** - one component per file, named `<feature>-<part>.tsx`
  after what it renders (`repository-clone-panel.tsx`,
  `repository-empty-state.tsx`). Component tests are colocated next to the
  component: `<name>.spec.tsx`.
- **hooks/** - one hook per file, file name starts with `use-` and carries a
  suffix by kind:
  - `use-<thing>.query.ts` - read hooks (wrap generated query hooks)
  - `use-<thing>.mutation.ts` - write hooks (wrap generated mutation hooks;
    own the cache invalidation and toasts)
- **helpers/** - pure functions, one concern per file (`.ts`, no JSX). If a
  helper is reusable beyond the feature it belongs in `src/shared/` (app-wide)
  or `@repo/domain` (business rule) instead.

Existing features that predate this convention (PascalCase components,
single `hooks.ts`, `lib/`) are migrated opportunistically - when touching a
file, move it to the convention; do not mix styles inside one feature.

## Rules

- Cross-feature imports go through the target feature's `index.ts` only.
- Features may import: `@repo/*` packages, `src/shared`, their own files.
- Features never import from `src/app` (the shell imports features, not vice versa).
- Server state comes from generated `@repo/api-client` hooks; feature hooks may
  wrap them, never re-implement fetching.
