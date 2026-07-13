# Agent Rules

## Security

- Never read `.env` files or files containing secrets, credentials, tokens, private keys, or production data.
- Never print secrets or credentials in logs, summaries, examples, commits, or generated files.
- When an environment variable is needed, explicitly tell the user and provide a safe example value or instructions for obtaining it.

## Communication

- Be concise and concrete.
- Prefer exact file paths, commands, and outcomes over broad narration.
- State assumptions clearly when project context is incomplete.
- If a command fails, report what failed, why it likely failed, and the next practical step.

## Project Context

- Project type: Data Room take-home assignment (see `test-task.md`; priorities: UX → polish → code). `PLAN.md` is the living plan — keep it current by editing existing blocks in place, never by appending new plans.
- Main language/runtime: TypeScript everywhere. Node 22 for `apps/api`, browser (Vite) for `apps/web`.
- Package manager: Bun (`bun@1.3.6`, Bun workspaces). Always `bun install`, `bun run <script>`, `bunx` — never npm/yarn/pnpm.
- Task runner: Turborepo (`turbo.json`). Root scripts fan out through turbo with a dependency graph.
- Frameworks: React 19 + Vite 8 (web), NestJS 11 + @nestjs/swagger (api), TanStack Query v5 via generated hooks, Orval v8 for client generation, TypeScript 6, Tailwind CSS v4 + shadcn/ui.
- Apps/packages:
  - `apps/web` — React SPA, the product. Consumes `@repo/api-client`, `@repo/ui`, `@repo/domain`, `@repo/config`.
  - `apps/api` — NestJS CRUD API over PostgreSQL + Drizzle (schema from `packages/db`; file bytes behind the `BlobStorage` abstraction, `db` or `s3` driver). Swagger UI at `/api/docs`.
  - `packages/domain` — pure domain model + business rules (naming, duplicates, cascade). No React/Nest/browser/storage imports. The cleanest package in the repo.
  - `packages/contracts` — authored DTO interfaces (web↔api contract surface). `apps/api` DTO classes implement them.
  - `packages/db` — PostgreSQL schema (Drizzle), committed migrations, `Database` type. Storage infrastructure only: no Nest, no imports from apps.
  - `packages/api-client` — GENERATED Orval client (react-query hooks + fetch mutator). `src/generated/**` is not committed.
  - `packages/ui` — the design system: shadcn/ui components on Tailwind v4 (`src/components/*`), `cn()` in `src/lib/utils.ts`, global stylesheet `src/styles/globals.css`. Subpath exports only (`@repo/ui/components/*`, `@repo/ui/lib/*`, `@repo/ui/globals.css`) — no barrel, no business logic.
  - `packages/config` — app-agnostic constants (API prefix, upload limits).
  - `tooling/*` — shared configs as workspace packages (`@repo/typescript-config`, `@repo/lint-config`, `@repo/format-config`, `@repo/tailwind-config`).
- Entry points: `apps/web/src/main.tsx`, `apps/api/src/main.ts` (HTTP :3000), `apps/api/src/openapi.ts` (emits `openapi.json`, no listener).
- Important directories: `docs/monorepo.md` (dependency rules + "Keeping order"), `docs/architecture.md`, `docs/design-system/` (design references), `tests/e2e/` (Playwright e2e suite).
- Auth: Clerk, optional by design. A global `ClerkAuthGuard` (`apps/api/src/shared/auth/`) verifies bearer tokens when `CLERK_SECRET_KEY` is set; without it the API falls back to a demo user so `bun run dev` stays zero-config.
- Local development command: `bun run dev` (turbo runs web on :5173 with `/api` proxy → api on :3000).
- Test command: `bun run test` (domain rules, api service + exception filter, HTTP e2e over fakes — no PostgreSQL required).
- Typecheck/lint command: `bun run typecheck`, `bun run lint`, `bun run format:check`.
- Build command: `bun run build`. API client regeneration: `bun run generate`.

## The Generated API Pipeline (source of truth)

The web↔api contract is generated, never hand-synced:

`apps/api` controllers/DTOs (@nestjs/swagger decorators) → `apps/api/openapi.json` (emitted by `api#openapi`) → Orval → `packages/api-client/src/generated/**` (react-query hooks).

- After ANY change to controllers or DTOs in `apps/api`, run `bun run generate` (turbo also chains it into `bun run build`/`typecheck` for web).
- Never edit `packages/api-client/src/generated/**` by hand; it is gitignored, prettier-ignored, and eslint-ignored.
- Never write manual `fetch` calls in `apps/web`; always use generated hooks/functions from `@repo/api-client`.
- The Orval fetch client wraps responses in an envelope `{ data, status, headers }` — in components read `query.data.data`. The custom mutator (`packages/api-client/src/mutator.ts`) throws `ApiError`; surface errors with `getApiErrorMessage(error)`.
- Clean operationIds come from `operationIdFactory` in `apps/api/src/swagger.ts` — name controller methods the way you want hooks named (`listDatarooms` → `useListDatarooms`).

## Repository Hygiene (anti-mess rules)

`docs/monorepo.md` ("Keeping order") is the rulebook; this section is the
enforcement summary for agents. Violating these is never acceptable, even in a
"quick fix".

1. **Respect ownership boundaries.** Business rules -> `@repo/domain` (pure
   functions), contract types -> `@repo/contracts`, schema/migrations ->
   `packages/db`, global constants -> `@repo/config`, UI primitives ->
   `packages/ui` (business-agnostic only). If a change makes a service or a
   component re-implement a domain rule, it is wrong — call the domain
   function instead. If code must know about another workspace's internals to
   work, the design is wrong — stop and propose instead of forcing it.
2. **Every new file has exactly one right home.** New api capability ->
   `apps/api/src/modules/<feature>/`; new web capability ->
   `apps/web/src/features/<name>/` (public entry via `index.ts`); work plans ->
   `PLAN.md` (edit existing blocks in place); documentation -> `docs/`. Never drop new files
   into the repo root — the root holds workspace-level config only.
3. **Leave no litter.** Before finishing, `git status` must contain only
   intentional changes. Delete scratch files, debug scripts, one-off outputs,
   commented-out blocks and dead code you produced along the way. Do not leave
   TODOs for things you were asked to do now.
4. **Reference material is quarantined.** Example/reference code brought in
   for discussion (like `env_example/`) is never imported by app code and is
   deleted once the real implementation lands. Do not "improve" reference code.
5. **One fact, one place.** Do not re-document the same rule in several files
   — link to the owning doc instead. Do not duplicate constants, defaults or
   config values across workspaces; put them in the owning package.
6. **Generated files are regenerated, never edited**
   (`packages/api-client/src/generated/**`, `apps/web/src/routeTree.gen.ts`,
   `apps/api/openapi.json`).
7. **Do not create parallel structures.** No second utils folder, no
   alternative error shape, no bespoke fetch wrapper, no new state manager —
   extend the existing one or propose a change first.

## Before Editing

- Before creating or editing non-trivial files, inspect similar files, nearby code, imported types, and existing project patterns.
- Repository patterns beat generic examples.
- Prefer the smallest change that fits the existing architecture.
- Do not introduce new libraries, tools, conventions, or abstractions unless clearly justified.
- If a task matches an available skill or documented workflow, read it before planning or editing.

## Code Style

- Prettier + ESLint from `tooling/format-config` / `tooling/lint-config` are the law: run `bun run format` and `bun run lint` before finishing.
- TypeScript strict; no `any`. Use discriminated unions like `DataroomNode = FolderNode | FileNode` and result types like `NameValidationResult` (`{ ok: true } | { ok: false; error }`) — follow this style for new fallible logic.
- `import type { ... }` for type-only imports.
- Named exports; no default exports (existing convention across packages).
- Comments only where behavior is non-obvious (see `packages/domain` docstrings for tone); no trivial helpers.
- Keep public surfaces explicitly typed; internals may infer.

## Architecture

Dependency direction is one-way (full rules in `docs/monorepo.md`):

- `apps/web` → contracts, domain, ui, config, api-client
- `apps/api` → contracts, domain, config, db
- `packages/contracts` → domain only; `packages/ui` → config at most; `packages/domain` → nothing app-specific.
- Forbidden: `packages/* → apps/*`, `apps/api ↔ apps/web`, `packages/ui →` web modules or business logic.
- Business rules (naming, duplicates, cascades, sorting) live in `@repo/domain` as pure functions. Neither the Nest service nor React components re-implement them — they call them.
- `apps/api` uses vertical feature modules (`src/modules/<feature>/` owns module internals; `app.module.ts` is only a composition root). Larger modules follow `domain/application/infrastructure/http`: `domain/` and `application/` must not import HTTP transport or Drizzle adapter code; controllers stay thin (validate → delegate → return DTO).
- New shared UI primitives go to `packages/ui` only if business-agnostic; otherwise keep them in `apps/web`.

## Data And API Contracts

- Extend the contract in this order: interface in `packages/contracts` → DTO class in `apps/api/src/modules/datarooms/http/dto.ts` implementing it (with `@ApiProperty` + class-validator) → controller method → `bun run generate` → consume hooks in web.
- Reuse existing request/response/domain types; never redefine contract types inline in web.
- Validation lives at the boundary: class-validator on DTOs plus domain rules in the service. Client-side checks may duplicate for UX, but the API is the enforcer.
- Error shape: Nest exceptions (`BadRequestException`, `ConflictException`, `NotFoundException`) with human-readable messages — the web shows them via `getApiErrorMessage`.
- Prefer backward-compatible API changes; document breaking ones in `PLAN.md`.

## Frontend

- The owning spec for web layout, import direction, and file placement is `apps/web/README.md` (details per area: `src/features/README.md`, `src/shared/README.md`) — read it before adding or moving web files.
- Vertical feature modules: `src/app` (shell/providers) -> `src/features/<name>` (public entry via `index.ts`) -> `src/shared`. Cross-feature imports only through a feature's `index.ts`; features never import from `src/app`.
- Follow existing component structure and state patterns: server state via generated TanStack Query hooks only; local UI state via React state. No extra state managers.
- Invalidate queries with generated key helpers (`getListDataroomsQueryKey()` etc.) after mutations.
- Handle all four states wherever data is fetched: loading, error, empty, success. Empty states get a CTA — this repo is judged on UX first.
- Reuse `packages/ui` primitives before creating new ones.
- Styling: Tailwind CSS v4 + shadcn/ui, live. Design tokens (shadcn `:root`/`.dark` variables + `@theme inline`) live in `tooling/tailwind-config/theme.css`; `apps/web/src/main.tsx` imports `@repo/ui/globals.css` once. Add components with `cd packages/ui && bunx shadcn@latest add <component>`; design references live in `docs/design-system/`. No inline `style={{}}` and no ad-hoc CSS files — Tailwind classes + `cn()` only.
- Destructive actions (delete folder with contents) require confirmation with an impact summary ("will delete N folders and M files" — use `collectSubtreeIds`).

## Backend

- Controllers → application service → repository port → Drizzle adapter; the adapter only maps rows and persists — use-case logic stays in application services, business rules in `@repo/domain`.
- Validate external input with DTO decorators + `ValidationPipe` (already global with `whitelist` + `transform`).
- Every endpoint declares swagger response types (`@ApiOkResponse({ type })`) — the generated client is only as good as the annotations.
- Cascade/consistency rules come from `@repo/domain` (`collectSubtreeIds`), not ad-hoc loops.

## Testing And Quality

Run relevant checks before finishing when code changed:

- `bun run typecheck`
- `bun run lint`
- `bun run format:check`

Before committing, run the full validation set:

- `bun run build`
- `bun run typecheck`
- `bun run lint`

If a required check cannot run because of missing services, credentials, dependencies, or environment setup, stop and tell the user exactly what is missing.

## Git And GitHub

- Never commit unless explicitly asked.
- Never push unless explicitly asked.
- Never create branches unless explicitly asked.
- Never create GitHub comments, issues, discussions, labels, releases, or PRs unless explicitly asked.
- Keep commits focused; use conventional-commit style messages (`feat:`, `fix:`, `docs:`, `chore:`) as in the existing history.
- Never commit generated outputs: `packages/api-client/src/generated/**`, `apps/api/openapi.json`, `dist/`, `*.tsbuildinfo` are gitignored — keep it that way.
- Do not commit `test-task.md` (assignment source stays untracked).
- No helper commit/push scripts (`commit2.py`, `push_and_check.py`, etc.).

## Dependency Management

- Do not add dependencies unless necessary; prefer existing ones and platform features.
- Add dependencies with Bun to the specific workspace package that needs them, not the root (root holds only repo-wide tooling: turbo, eslint, prettier, typescript).
- Shared config packages (`tooling/*`) carry rule/config dependencies; CLI binaries (eslint, prettier) live at the root.
- Any package extending `@repo/typescript-config` must declare it in its own `devDependencies`, or Bun will not link it and tsc silently falls back to ES3 defaults.
- Do not update unrelated dependencies.

## Documentation

- Update documentation when behavior, commands, setup, or public APIs change: `PLAN.md` (edit existing blocks in place), `docs/monorepo.md` (boundary rules), `docs/architecture.md`, `README.md` (setup + design decisions — this is a graded deliverable).
- Keep documentation factual and close to the implemented behavior.
- Prefer examples that can be copied and run safely.

## Handoff

When finishing, report:

- Files changed.
- Commands run and results.
- Behavior changed.
- Any follow-up the user needs to do.
- Any checks that were skipped and why.
