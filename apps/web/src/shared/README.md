# shared/

App-wide, feature-agnostic building blocks. Rules:

- A feature may import from `shared/`; `shared/` never imports from `features/`.
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
                       node-tree walking, DTO adapters, pdf.js setup.
      store/        <- client-side global UI state (zustand). Server state
                       stays in TanStack Query; only view preferences live here.
