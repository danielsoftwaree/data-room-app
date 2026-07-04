# Data Room MVP

Take-home project: a virtual Data Room (secure document repository) built as a
production-shaped monorepo.

## Stack

Bun workspaces + Turborepo. React 18 + TypeScript + Vite (`apps/web`),
NestJS (`apps/api`), shared packages for domain, contracts, ui and config.

## Layout

```
apps/web      React SPA (the product)
apps/api      NestJS API (thin health/contract surface)
packages/     contracts | domain | ui | config
tooling/      typescript-config | lint-config | format-config | tailwind-config
tests/e2e     (placeholder) Playwright suite
docs/         architecture.md | monorepo.md
```

See `docs/monorepo.md` for the dependency rules and `docs/architecture.md` for design
decisions. `PLAN.md` holds the product plan.

## Setup

```bash
bun install
```

## Development

```bash
bun run dev        # web on :5173 (+ /api proxy), api on :3000
bun run build      # full ordered build via turbo
bun run typecheck
bun run lint
bun run format
```
