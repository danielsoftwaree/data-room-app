# Auth: Clerk (design sketch — out of scope for the MVP)

Status: **not implemented, and dependencies are intentionally not installed.**
Authentication is extra-credit in the brief and was deliberately left out to keep
the app zero-friction "works out of the box" rather than gating it behind a login
(see the trade-offs section in the README). This document is a forward-looking
integration plan so adding auth later is a mechanical step, not a redesign.

## Integration plan (if auth lands)

### Frontend (`apps/web`)

1. Add `@clerk/clerk-react`, then wrap the tree in
   `<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>`
   inside `src/app/providers.tsx` (providers already compose there).
2. Gate the app with `<SignedIn>` / `<SignedOut>` + `<SignIn />`; add `<UserButton />`
   to the header. Clerk UI components inherit our Tailwind tokens via the appearance API.
3. Attach the session token to API calls in ONE place — the Orval fetch mutator
   (`packages/api-client/src/mutator.ts`): `Authorization: Bearer ${await getToken()}`.
   No per-hook changes; generated hooks stay untouched.

### Backend (`apps/api`)

1. Add `@clerk/backend` (framework-agnostic token verification). A `ClerkAuthGuard`
   (global `APP_GUARD`) verifies the bearer token with
   `verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })`.
2. Public endpoints (e.g. `/api/health`) opt out via a `@Public()` decorator + reflector.
3. Attach `{ userId }` to the request; services receive it as a parameter — domain
   (`@repo/domain`) stays auth-agnostic.

### Data model impact

- `datarooms` gains `owner_id` (Clerk user id); list/queries filter by it. Kept out
  of the current schema on purpose — no dead columns before the feature exists.

## Friction note

If auth is added for a hosted demo, keep a zero-friction path (a "Continue as
demo" affordance or seeded test credentials on the sign-in screen) so an
evaluator isn't blocked by a sign-up wall before seeing the product.
