# player

The member app: a PWA on a 390 px phone. Tonight's floor, the waitlist, session history, balance and withdrawals, rewards, Learn and the member's profile. Every member-facing entry point is behind `FeatureGate` with its tier-gated feature key.

## Run it

```
pnpm db:start                 # this worktree's local Supabase, seeded
pnpm dev --filter player
```

The dev server listens on this worktree's port block (`player` is port `<block>40`, so `54340`-style on the root checkout; see `docs/decisions/0003`). `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` default to the local stack; CI and deploys set them. Sign in with a seed phone number and code `123456` (`supabase/seed/10_people.sql`).

`pnpm test --filter player` runs the app's tests; `pnpm e2e --grep "<flow>"` runs a flow across apps.

## Structure

```
src/
  main.tsx            the client, the providers and the router
  router.tsx          every route, in one list
  routes/             one file per URL; renders a feature's screen and nothing else, loaded with
                      lazyRouteComponent so it stays out of the initial JavaScript (#11). frame.tsx
                      (the tabs) and root.tsx are the only eager routes; sign-in sits outside the frame
  features/<name>/    components/ and hooks/, imported only through index.ts
    frame/            the app's shell: navigation, the kill-switch banner, not found
```

Everything visible comes from `@rivr/ui`, every word from `@rivr/i18n`, every read through `@rivr/db`. A route imports only features, and a feature never imports another feature; `pnpm lint:deps` fails either (`.claude/rules/apps.md`).

## Who builds what

Lane C owns the shell, routes, sign-in and KYC, Home, Sessions, Profile and Learn. Lane A adds `features/balance`, lane B `features/waitlist`, `call-time`, `tournament` and `fnb`, and lane D `features/rewards`, `promotions` and `winner-cards` (`docs/contracts/`).

## Budgets

Initial JavaScript under 200 KB gzipped, checked in CI by `scripts/check-bundle.mjs`.
