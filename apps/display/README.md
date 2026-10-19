# display

The TV app at 1920 px: waitlist and call-time boards, jackpot and high hand, the tournament clock, the promotions rotation and the other TV modes. A TV pairs with a six-digit code and then shows the mode a manager assigns it.

## Run it

```
pnpm db:start                 # this worktree's local Supabase, seeded
pnpm dev --filter display
```

The dev server listens on this worktree's port block (`display` is port `<block>43`, so `54340`-style on the root checkout; see `docs/decisions/0003`). `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` default to the local stack; CI and deploys set them. Sign in with a seed phone number and code `123456` (`supabase/seed/10_people.sql`).

`pnpm test --filter display` runs the app's tests; `pnpm e2e --grep "<flow>"` runs a flow across apps.

## Structure

```
src/
  main.tsx            the client, the providers and the router
  router.tsx          every route, in one list
  routes/             one file per URL; renders a feature's screen and nothing else
  features/<name>/    components/ and hooks/, imported only through index.ts
    frame/            the app's shell: navigation, the kill-switch banner, not found; the pairing code until the TV is paired
    pairing/          a TV that is not paired shows a six-digit code for the console's TVs screen (#49)
    modes/            a paired TV shows the mode the console gave it: the waitlist board and the jackpot
                      with tonight's high hand (#65), live through Realtime; other modes show their name
```

Everything visible comes from `@rivr/ui`, every word from `@rivr/i18n`, every read through `@rivr/db`. A route imports only features, and a feature never imports another feature; `pnpm lint:deps` fails either (`.claude/rules/apps.md`).

## Who builds what

Lane B owns every mode, built from `@rivr/ui` and lane D's templates.

## Budgets

A TV recovers its mode within 5 seconds of a reload.
