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

A link to any screen opened signed out goes to `/sign-in?next=<that screen>`, and a new number then to `/sign-up?next=…`. Each returns there when done, which is how the website's links land on the Academy. `next` is checked by `returnSearchFrom` (`@rivr/contracts/returnPath`): only a path in the app, never another site (#233).

Everything visible comes from `@rivr/ui`, every word from `@rivr/i18n`, every read through `@rivr/db`. A route imports only features, and a feature never imports another feature; `pnpm lint:deps` fails either (`.claude/rules/apps.md`).

## Who builds what

Lane C owns the shell, routes, sign-in and KYC, Home, Sessions, Profile and Learn. Lane A adds `features/balance`, lane B `features/waitlist`, `call-time`, `tournament` and `fnb`, and lane D `features/rewards`, `promotions` and `winner-cards` (`docs/contracts/`).

## Installed app (PWA)

The build writes the manifest and a service worker (`vite-plugin-pwa`, `vite.config.ts`). The manifest's colours, and the theme colour in `index.html`, come from `@rivr/tokens`. The icons in `public/icons` and the iPhone launch screens in `public/splash` come from the brand kit (`docs/brand`, never edited by hand); `index.html` links each launch screen to the screen it fits.
- **Offline.** The service worker keeps the shell, so the app opens with no connection. It keeps no data: a screen offline waits for the connection (its loading state) under the frame's `OfflineBanner`, and loads once it returns. The app asks for a new version every hour. One that arrives waits until the page is out of sight, then takes over and reloads it (`takeUpdateWhenHidden`, #252), so a member typing a UTR or a code never loses it, and a fix still reaches an app left open the next time the member leaves it.
- **Install offer.** The frame offers to install the app on Tonight, from a member's second visit, and only after sign-up: on iPhone an app installed before sign-up cannot read the link's codes (decision 0031). It asks the browser where it can, and on iPhone says how (Share, then Add to Home Screen). Not now, or answering the browser's dialog either way, puts it away for good. `startInstallWatch` (`main.tsx`) counts each opening of the app once (a reload or the return from DigiLocker is the same visit) and keeps the browser's prompt, which fires once and often before Tonight has drawn.

`pnpm e2e --grep "PWA"` checks the manifest and its icons, every launch screen against its screen, and opening offline.

## Budgets

Initial JavaScript under 200 KB gzipped, checked in CI by `scripts/check-bundle.mjs`. With the service worker's registration it is about 178 KB.
