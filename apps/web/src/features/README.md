# features/

Vertical feature modules. One directory per user-facing capability
(`datarooms`, later: `nodes-tree`, `file-upload`, `file-viewer`, ...).

Structure inside a feature (create subdirs only when needed):

    features/<name>/
      index.ts          <- public entry; the ONLY import path for outsiders
      components/       <- feature UI
      hooks/            <- feature-specific hooks (wrapping @repo/api-client)
      lib/              <- feature-local helpers

Rules:

- Cross-feature imports go through the target feature's `index.ts` only.
- Features may import: `@repo/*` packages, `src/shared`, their own files.
- Features never import from `src/app` (the shell imports features, not vice versa).
- Server state comes from generated `@repo/api-client` hooks; feature hooks may
  wrap them, never re-implement fetching.
