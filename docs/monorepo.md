# Monorepo layout

Bun workspaces + Turborepo.

```
apps/       runnable applications only
packages/   reusable internal libraries
tooling/    shared configs, versioned as workspace packages
tests/      cross-app test suites (e2e)
docs/       architecture docs
```

## Why the split exists

The monorepo is not about folders - it fixes ownership:

- **apps** run the product. `apps/web` (React SPA) and `apps/api` (NestJS) are entrypoints;
  nothing imports them.
- **packages** hold reusable logic. They never import from `apps/*`.
- **tooling** keeps quality identical everywhere: TS/lint/format/tailwind configs are
  workspace packages (`@repo/typescript-config`, ...), not copy-pasted dotfiles.

## Dependency direction

```
apps/web ─────┐
              ├── packages/contracts
apps/api ─────┘
   │
   ├── packages/domain
   └── packages/config

apps/web ─── packages/ui
packages/contracts ─── packages/domain
packages/domain ─── nothing app-specific
```

Forbidden: `packages/* -> apps/*`, `apps/api -> apps/web`, `apps/web -> apps/api` source
imports (HTTP/contracts boundary only), `packages/ui -> web modules`.

`packages/domain` is the cleanest package: pure types + business rules
(naming, duplicate resolution, tree traversal). No React, Nest, browser APIs or storage.

## Build model

- `@repo/domain`, `@repo/contracts`, `@repo/config` are compiled libraries (tsc -> `dist/`),
  so the Nest `tsc` build can consume them. Turbo orders builds via `dependsOn: ["^build"]`.
- `@repo/ui` is a just-in-time package: it exports TSX source and is bundled by the
  consuming app (Vite). Only `apps/web` consumes it. It hosts the shadcn/ui design
  system: the shadcn CLI vendors components into `src/components`, consumed via subpath
  exports (`@repo/ui/components/*`); Tailwind v4 scans its sources via `@source` in
  `src/styles/globals.css`.
- `typecheck` depends on `^build` because apps typecheck against the emitted `.d.ts`
  of library packages.

## Commands

```bash
bun install
bun run build        # turbo run build (ordered by the task graph)
bun run typecheck
bun run dev          # web :5173 + api :3000 (persistent, uncached)
bun run lint
bun run format
```

A root `test` script appears together with the first test suites (unit / e2e) -
we do not ship placeholder commands.
