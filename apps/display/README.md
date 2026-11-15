# display

The TV app at 1920 px: the five boards (redesign RD-28), the waitlist, call time (titled Seats opening), the promotions, the hours leaderboard and the high hand bonus, with no rupee (#628, decision 0284). Every board stands on one stage: the wordmark, the board's title, the club's time, and along the foot the club's notice while one runs. Each has a bar along the stage's foot that fills over its seconds, which Settings, TVs, Rotation gives it. When the TV's reads fail, as in a network drop, the boards keep what they had and a quiet line at the foot says since when (F3-24). A TV pairs with a six-digit code and then shows the mode a manager assigns it.

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
    frame/            the app's shell: navigation, not found; the pairing code until the TV is paired; the clock and the club's notice for every board
    pairing/          a TV that is not paired shows a six-digit code for the console's TVs screen (#49)
    modes/            the five boards (decision 0631), each a mode on one stage: the waitlist (#65), seats opening (decision 0163), the promotions (#86),
                      the hours played, tonight's and the period's the club set (decision 0581), and the high hand bonus (`toHighHandBoard`, redesign RD-25),
                      live through Realtime; a paired TV shows its own board, then those it turns to, less any the club switched off, each for the seconds
                      Settings, TVs, Rotation gives it (`tv.board_seconds`)
```

Everything visible comes from `@rivr/ui`, every word from `@rivr/i18n`, every read through `@rivr/db`. A route imports only features, and a feature never imports another feature; `pnpm lint:deps` fails either (`.claude/rules/apps.md`).

## Who builds what

Lane B owns every mode, built from `@rivr/ui` and lane D's templates.

## Budgets

A TV recovers its mode within 5 seconds of a reload.

In a rotation, a board with nothing to show passes its turn on; the main board never does, and promotions with none live show for one slide's time (D-03, decision 0293).
