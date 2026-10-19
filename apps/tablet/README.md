# tablet

The dealer tablet: hand entry (seats, pot, Log hand), rake and jackpot drop, buy-in requests and the down's drop box. It must keep working offline: hands and their high-hand claims go through `useHandQueue` (`@rivr/offline`), so Log hand confirms at once and the hand arrives in order once the connection is back; a slim banner says how many are queued ("Offline. 3 hands queued."), and a hand refused for good is set aside and counted there for a supervisor (#43).

## Run it

```
pnpm db:start                 # this worktree's local Supabase, seeded
pnpm dev --filter tablet
```

The dev server listens on this worktree's port block (`tablet` is port `<block>42`, so `54340`-style on the root checkout; see `docs/decisions/0003`). `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` default to the local stack; CI and deploys set them.

The tablet signs in as itself, never as a person (#41, decision 0045). To pair it locally, sign in to the console as a floor manager (`9000000103`, code `123456`), open Tablets, add one and type its six-digit code on the tablet. Fix it to a table on the same screen. A revoked tablet asks to be paired again.

`pnpm test --filter tablet` runs the app's tests; `pnpm e2e --grep "<flow>"` runs a flow across apps.

## Android

The APK is a Capacitor shell around the hosted bundle, so code changes reach tablets without a reinstall. Locally:

```
pnpm build --filter tablet
pnpm --filter tablet exec cap sync android
cd apps/tablet/android && ./gradlew assembleDebug
```

The release workflow builds the signed APK from a `release-*` tag (`docs/runbooks/ci-and-release.md`). Colours come from `@rivr/tokens`' generated Android resources.

At the club each tablet runs in kiosk mode (Android lock task, #41): provisioned as the device owner over adb, the app locks the tablet to itself, is its home screen and keeps the screen on (`docs/runbooks/dealer-tablet.md`). On a device that is not provisioned, such as a developer's phone, it runs as a normal app.

## Structure

```
src/
  main.tsx            the client, the providers and the router
  router.tsx          every route, in one list
  routes/             one file per URL; renders a feature's screen and nothing else
  features/<name>/    components/ and hooks/, imported only through index.ts
    frame/            the app's shell: the table it is fixed to, the kill-switch banner, not found
    pairing/          the pairing code, until the tablet is signed in as itself
    dealer-sign-in/   between downs: the dealer's name and PIN, which starts their down
    hand-entry/       during a down (#42): the pot keypad, the game, the rake, drop and pull as the pot is
                      typed (@rivr/domain potTake on the table's rules), Log hand, and the down's last hands,
                      with what the floor made of each high-hand claim; the High hand switch sends one with a hand (#47)
```

Everything visible comes from `@rivr/ui`, every word from `@rivr/i18n`, every read through `@rivr/db`. A route imports only features, and a feature never imports another feature; `pnpm lint:deps` fails either (`.claude/rules/apps.md`).

## Who builds what

Lane B owns all of it.

## Budgets

Tap to confirm under 100 ms.
