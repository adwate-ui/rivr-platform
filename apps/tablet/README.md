# tablet

The dealer tablet: hand entry (seats, pot, Log hand), rake and jackpot drop, buy-in requests and the down's drop box. It must keep working offline: writes go through `@rivr/offline`, and a refused write is parked for a supervisor.

## Run it

```
pnpm db:start                 # this worktree's local Supabase, seeded
pnpm dev --filter tablet
```

The dev server listens on this worktree's port block (`tablet` is port `<block>42`, so `54340`-style on the root checkout; see `docs/decisions/0003`). `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` default to the local stack; CI and deploys set them. Sign in with a seed phone number and code `123456` (`supabase/seed/10_people.sql`).

`pnpm test --filter tablet` runs the app's tests; `pnpm e2e --grep "<flow>"` runs a flow across apps.

## Android

The APK is a Capacitor shell around the hosted bundle, so code changes reach tablets without a reinstall. Locally:

```
pnpm build --filter tablet
pnpm --filter tablet exec cap sync android
cd apps/tablet/android && ./gradlew assembleDebug
```

The release workflow builds the signed APK from a `release-*` tag (`docs/runbooks/ci-and-release.md`). Colours come from `@rivr/tokens`' generated Android resources.

## Structure

```
src/
  main.tsx            the client, the providers and the router
  router.tsx          every route, in one list
  routes/             one file per URL; renders a feature's screen and nothing else
  features/<name>/    components/ and hooks/, imported only through index.ts
    frame/            the app's shell: navigation, the kill-switch banner, not found
```

Everything visible comes from `@rivr/ui`, every word from `@rivr/i18n`, every read through `@rivr/db`. A route imports only features, and a feature never imports another feature; `pnpm lint:deps` fails either (`.claude/rules/apps.md`).

## Who builds what

Lane B owns all of it.

## Budgets

Tap to confirm under 100 ms.
