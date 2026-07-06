# shared/

Cross-feature building blocks. Something belongs here only if it passes one of
two tests:

1. **Used by two or more features** (or by a feature + the app shell) and
   owned by none of them — `name-dialog`, `user-menu`, `confirm-dialog`,
   `storage-usage-card`, `format`.
2. **Fully generic or third-party integration**, with no knowledge of the
   domain model — `use-object-url`, the pdf.js setup in `lib/pdf-viewer`.

A domain-specific module with a single consumer feature lives in THAT feature
(see `features/README.md`), even if it looks reusable; promote it here when a
second consumer appears. More rules:

- A feature may import from `shared/`; `shared/` never imports from
  `features/`, `app/`, or `routes/`.
- If something is reusable across apps (not just this SPA), it belongs in
  `packages/ui` (visual primitive) or `packages/domain` (business rule) instead.
- kebab-case file names, one concern per file. Import concrete files directly
  (`@/shared/lib/format`) — no barrel.

## Layout

    shared/
      components/   <- generic UI used by several features (name-dialog,
                       confirm-dialog, user-menu, ...). One component per file.
      hooks/        <- generic React hooks (use-object-url). The ONLY place a
                       raw `useEffect` may live (see the no-use-effect rule).
      lib/          <- pure/browser utilities with no React state: formatting,
                       pdf byte generation, pdf.js worker setup.
      store/        <- client-side global UI state (zustand). Server state
                       stays in TanStack Query; only view preferences live here.
