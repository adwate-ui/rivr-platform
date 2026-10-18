# console

The staff web app at 1440 px: the live floor, waitlist, cage, members, promotions, staff and reports, with a left rail grouped as the design prompt lists it. What each person sees comes from their role's permissions in the database.

## Run it

```
pnpm db:start                 # this worktree's local Supabase, seeded
pnpm dev --filter console
```

The dev server listens on this worktree's port block (`console` is port `<block>41`, so `54340`-style on the root checkout; see `docs/decisions/0003`). `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` default to the local stack; CI and deploys set them. Sign in with a seed phone number and code `123456` (`supabase/seed/10_people.sql`).

`pnpm test --filter console` runs the app's tests; `pnpm e2e --grep "<flow>"` runs a flow across apps.

## Structure

```
src/
  main.tsx            the client, the providers and the router
  router.tsx          every route, in one list
  routes/             one file per URL; renders a feature's screen and nothing else
  features/<name>/    components/ and hooks/, imported only through index.ts
    frame/            the app's shell: staff only, the rail for the role, who is signed in, the
                      practice venue switch, sign out, the kill-switch banner, not found
    sign-in/          mobile number and code, as in the player app (decision 0032)
    academy/          Academy batches, company bookings, recording a UTR and cancelling (Academy staff,
                      /academy); the payments the cage checks against the bank (/academy/payments)
```

Staff sign in at `/sign-in`; everyone else is sent there. The console works in one venue at a time, the club unless the staff member turns on "Practice venue", and every screen reads and writes for that venue through `useStaffVenue()` from `@rivr/db`. A screen adds its rail entry, with the permissions that may see it, in `features/frame/components/rail.ts`.

Everything visible comes from `@rivr/ui`, every word from `@rivr/i18n`, every read through `@rivr/db`. A route imports only features, and a feature never imports another feature; `pnpm lint:deps` fails either (`.claude/rules/apps.md`).

## Who builds what

Every lane adds console features: lane A the cage, markers, treasury, end of day, withdrawals, expenses, reports, owner dashboard and admin; lane B the live floor, waitlist, tables, tournaments, jackpots, high hands, TV screens, dealers, SOPs, incidents, F&B and pot data; lane C KYC review, members, Academy, website, Learn sources and cab; lane D promotions, rewards, League, social, creators, host queue, growth funnel and feedback (`docs/contracts/`).

## Budgets

Tables are virtualised past 200 rows.
