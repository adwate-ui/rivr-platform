# @rivr/sim-180d

Runs RIVR as a club for 180 nights (15 Nov 2026 to 13 May 2027) on its own database with a virtual clock. It then looks at every screen as every role, and walks every workflow end to end. It finds what keeps RIVR from being world class: bugs, broken hand-offs, copy, design, accessibility, speed and code.

It runs by hand, never in CI. CI runs only its unit tests. It never touches production; staging only in the staging walks, under their preconditions.

## Layout

| Folder | What is in it |
|---|---|
| `src/` | Pure logic with unit tests, held to 80% line coverage: the calendar and growth, the catalogue, the census plan and checks, the night runner, the report, the staging preflight's logic |
| `bin/` | The commands. They drive Docker, psql, the Supabase CLI and Playwright |
| `sql/` | The simulation itself. People act in Postgres as themselves (`request.jwt.claims`), as in the 90-day run of 28 Oct |
| `census/` | The screen census: every screen as every person at every size, with its states |
| `walks/` | Every e2e flow, unchanged, on a checkpoint night, with the browser on the simulation's clock |
| `staging/` | The staging preflight (read only) |

Everything a run makes goes to `~/.rivr-sim180/`, outside the repository: `rivr-sim180-db/` (the rewritten copy), `catalogue.json`, `runs/<run>/` (snapshots, report, census, walks).

## How to run it

Run inside WSL, from `scripts/sim-180d`. The stack uses port block 557.

| Stage | Command | What it does |
|---|---|---|
| Gate | `pnpm gate` | Refuses unless every edit is in: the batch PRs merged, no other PR open, every worktree clean, the harness pushed and rebased on main. Prints both commits |
| Catalogue | `pnpm catalogue` | Every screen of every app, and every call `packages/db` makes, read from the code |
| Simulation | `pnpm sim -- --prepare --start=sim --reset --to=180` | Rewrites the copy's time calls, starts its stack, loads night 0, runs 180 nights with the real message consumers, snapshots nights 0, 1, 7, 30, 47 (31 Dec), 90 and 180, and writes `report.md` |
| Census | `pnpm census -- --night=30 [--sizes=first]` | Restores the checkpoint, plays the next night to 22:00, signs everyone in, visits every screen as every person at every size, then writes `flags.json` and `census.md` |
| Walks | `pnpm walks -- --night=30` | Every e2e flow on that night at 22:00, with the browser on the simulation's clock; writes `walks.md` |
| Staging | `STAGING_TEST_OTP=… pnpm staging:preflight` | Read only: staging's apps answer, its test numbers take the code, and `WHATSAPP_ALLOWLIST` holds the owner's number alone, by digest |
| Stop | `pnpm sim -- --stop` | Stops the copy's stack |

## How it works

- **The clock.** `prepare` copies `supabase/` and `packages/` at HEAD into `~/.rivr-sim180/rivr-sim180-db`, rewrites every `now()`, `clock_timestamp()` and `current_date` to `sim_clock`, and adds the clock as the first migration. Applied migrations are never edited. pg_cron is paused; `sim.goto` fires each job as the clock crosses its time.
- **People.** Each acts in SQL as themselves through `sim.try` (their JWT claims and row-level security). A night is 60 ten-minute steps: arrivals at the door (kiosk or desk), per-table waitlists with the floor's approvals, seating with bonus chips, top-ups, Add time, moves, the leaving list, food and drink, rewards, spins, points and bonus chips by hand, the roster, and the calendar's scripted events.
- **Messages.** After each step the real consumers from `@rivr/adapters/messages` run in Node with recording fakes; every message lands in `sim.message`.
- **Two at once.** One race a night (all five on peak nights): two staff seating one member, double taps on an order, a top-up and a reward, and an approval racing the member leaving.
- **Checks.** 31 invariants after every night (`sql/11`–`13`, named in `src/invariants/codes.ts`), the heavier ones every 30 nights, and the TV boards at 23:00.
- **Census and walks.** Each checkpoint is restored and played to 22:00 so the room is full. The browser's clock starts at the simulation's time (`census/clock.ts`, `walks/clocked.ts`), and Auth's session expiry is moved onto it.

## Spikes (8 Nov 2026)

| Spike | Question | Result |
|---|---|---|
| S1 | Does a signed-in app work with the browser months ahead, on the simulation's clock? | Yes, with `census/clock.ts`. Auth issues tokens on real time, so without it the player app refreshed its token 318 times in an hour of browser time; with each session's `expires_at` moved onto the browser's clock, once. The token itself is untouched. |
| S2 | Do the real outbox consumers run in Node against the copy? | Yes. On the seeded copy they claimed 79 deliveries and recorded the owner's alert in `sim.message`. |
| S3 | Does the virtual clock reach every job? | Yes. 1,424 `now()`, 12 `clock_timestamp()` and 7 `current_date` calls rewritten, none left. One quiet night fires all 17 non-outbox jobs with no failures, in 0.6 s. Start and reset take 86 s. |

Sign-in in the browser: Auth sends one code a minute to a number ("Too many tries. Wait a minute."), so every browser that signs in uses its own seeded number. The two floor managers the simulation hires take the two spare local test numbers (901, 902) for the census.

## Harness mistakes, found and fixed

Each was confirmed against RIVR's code before it was fixed. A RIVR defect is a finding, never fixed here.

| Mistake | Fix |
|---|---|
| Two sign-ups could get the same made-up number (night 0's 100th and night 1's first) | Numbers spaced 500 a night |
| The local seed plays a "tonight" at the live venue (waiting places, seats, visits stamped minutes before now), so members already held places on night 1 | Night 0 closes it as the club would (`sim.close_rehearsal`) |
| `leave_my_seat` with call time owed only puts the member on the leaving list, and check-out is refused until the floor lets them go early | The floor ends the seat, and lets a member who owes call time leave early with a reason |
| Call times longer than the member's evening | The floor offers the longest call time that fits; one in ten leave early on purpose |
| The floor reused the member's own request id when adding them by phone | One request id per ask |
| The floor tried to seat members the desk had not checked, every step | The board marks them; the floor seats the next |
| A member refused at the waitlist for the identity check took no selfie | The app asks for the selfie first; the member takes it and joins again |
| Checks compared text with uuid, and built the claims after taking the role | Types cast; claims first |
| A promotion's welcome grant counted as bonus chips "given by hand" to the member's own record | N04 judges only grants no promotion made |
| A snapshot restarts the stack, leaving a stale keep-alive socket for the next request | A request that fails before it is sent is tried again, up to three times |
| N11 and N13 matched a hidden member's first name and initial against another member who shares it | The boards' own `first_name_and_initial`, counted only where no member on the TVs shares the short name |

## Not covered

- A real tablet and real TVs (their sizes are emulated, and the tablet APK is not tested), Cashfree (off), real money, load beyond a peak night.
- Hidden modules, apart from being unreachable and showing no ₹.
- Edge in the staging walks: Chromium, the same engine, runs them.
