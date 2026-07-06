# features/

Vertical feature modules. One directory per user-facing capability
(`datarooms`, `dataroom-browser`, ...). App-wide layering and "where does a
new file go" live in [`apps/web/README.md`](../../README.md); this file owns
the conventions INSIDE a feature.

## Layout

    features/<name>/
      index.ts          <- public entry; the ONLY import path for outsiders
      components/       <- feature UI (one public component per file)
      hooks/            <- feature-specific hooks (state + @repo/api-client wrapping)
      helpers/          <- pure feature-local helpers (no React, no I/O)
      types.ts          <- (optional) feature-wide types shared by several files

Create subdirectories only when needed: a small feature can start with just
`index.ts` and `components/`. Besides `index.ts` and `types.ts`, the feature
root may hold a module that is neither UI, hook, nor pure helper — e.g. an
imperative API script like `datarooms/create-sample-dataroom.ts` — named after
its export; anything else goes in the three directories.

Route files stay in `src/routes/` (TanStack Router scans that directory).
Keep them thin: parse params, render the screen imported from the feature's
`index.ts` - no logic in route files.

## File conventions

- **kebab-case file names** everywhere: `dataroom-browser-screen.tsx`,
  `sort-nodes.ts`.
- **components/** - one public component per file (small private
  subcomponents may live next to it), named after what it renders:
  `toolbar.tsx`, `move-dialog.tsx`. Prefix with the feature/screen name only
  when the short name would be ambiguous or collide with a `@repo/ui`
  primitive (`browser-empty-state.tsx`, `browser-context-menu.tsx`). The
  feature's screen is `<name>-screen.tsx`. Component tests are colocated:
  `<name>.spec.tsx`.
- **hooks/** - one hook per file, file name starts with `use-` and carries a
  suffix by kind:
  - `use-<thing>.query.ts` - read hooks (wrap generated query hooks)
  - `use-<thing>.mutation.ts` - write hooks (wrap generated mutation hooks;
    own the cache invalidation and toasts)
  - `use-<thing>.ts` (no suffix) - pure UI-state hooks (selection, dialogs,
    view options) and coordinators that mix reads and writes (`use-favorites`)
- **helpers/** - pure functions, one concern per file (`.ts`, no JSX). If a
  helper is reusable beyond the feature it belongs in `src/shared/` (app-wide)
  or `@repo/domain` (business rule) instead — but not before a second
  consumer actually exists.

All features follow this convention; if you find a stray file, move it in the
same PR rather than copying its style.

## Rules

- Cross-feature imports go through the target feature's `index.ts` only, and
  the feature dependency graph stays acyclic.
- Features may import: `@repo/*` packages, `src/shared`, their own files.
- Features never import from `src/app` (the shell imports features, not vice versa).
- Server state comes from generated `@repo/api-client` hooks; feature hooks may
  wrap them, never re-implement fetching.
- Components stay declarative: screen logic lives in `hooks/`, screens compose.
