# driver

The driver's phone app for member cab pickups, shipped as an Android Capacitor shell around the hosted bundle, as the tablet is.

## Run it

```
pnpm db:start                 # this worktree's local Supabase, seeded
pnpm dev --filter driver
```

The dev server listens on this worktree's port block (`driver` is port `<block>44`, so `54340`-style on the root checkout; see `docs/decisions/0003`). `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` default to the local stack; CI and deploys set them. Sign in with a seed phone number and code `123456` (`supabase/seed/10_people.sql`).

`pnpm test --filter driver` runs the app's tests; `pnpm e2e --grep "<flow>"` runs a flow across apps.

## Android

```
pnpm build --filter driver
pnpm --filter driver exec cap sync android
cd apps/driver/android && ./gradlew assembleDebug
```

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

Lane C owns all of it.
