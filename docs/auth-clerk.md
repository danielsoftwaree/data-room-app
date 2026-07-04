# Auth: Clerk (scaffolded, not implemented)

Status: dependencies and environment are laid down; **no auth code is written yet**.
This document is the integration plan so implementation later is a mechanical step.

## What is already in place

- `apps/web`: `@clerk/clerk-react` dependency; `VITE_CLERK_PUBLISHABLE_KEY` typed in
  `src/vite-env.d.ts`.
- `apps/api`: `@clerk/backend` dependency (framework-agnostic token verification;
  no Nest-specific wrapper needed).
- `.env.example` at the repo root documents both keys. `.env` stays untracked.

## Integration plan (when auth lands)

### Frontend (`apps/web`)

1. Wrap the tree in `<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>`
   inside `src/app/providers.tsx` (providers already compose there).
2. Gate the app with `<SignedIn>` / `<SignedOut>` + `<SignIn />`; add `<UserButton />`
   to the header. All Clerk UI components inherit our Tailwind tokens via appearance API.
3. Attach the session token to API calls in ONE place — the Orval fetch mutator
   (`packages/api-client/src/mutator.ts`): `Authorization: Bearer ${await getToken()}`.
   No per-hook changes; generated hooks stay untouched.

### Backend (`apps/api`)

1. `ClerkAuthGuard` (global `APP_GUARD`) verifies the bearer token with
   `verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })` from `@clerk/backend`.
2. Public endpoints (e.g. `/api/health`) opt out via a `@Public()` decorator + reflector.
3. Attach `{ userId }` to the request; services receive it as a parameter — domain
   (`@repo/domain`) stays auth-agnostic.

### Data model impact

- `datarooms` gains `owner_id` (Clerk user id) when auth lands; list/queries filter by it.
  Kept out of the current schema on purpose — no dead columns before the feature exists.

## Rules until implementation

- Do not import Clerk anywhere in app code yet — dead auth UI is worse than none
  (assignment: no unimplemented features).
- Never read `.env`; reference `.env.example` for variable names.
