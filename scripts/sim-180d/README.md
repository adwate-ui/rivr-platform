# @rivr/sim-180d

Runs RIVR as a club for 180 nights (15 Nov 2026 to 13 May 2027) on its own database with a virtual clock. It then looks at every screen as every role, and walks every workflow end to end. It finds what keeps RIVR from being world class: bugs, broken hand-offs, copy, design, accessibility, speed and code.

It runs by hand, never in CI. CI runs only its unit tests.

## Layout

| Folder | What is in it |
|---|---|
| `src/` | Pure logic with unit tests, held to 80% line coverage |
| `bin/` | The commands. They drive Docker, psql and the Supabase CLI |
| `sql/` | The simulation itself. People act in Postgres as themselves (`request.jwt.claims`), as in the 90-day run of 28 Oct |

Everything a run makes goes to `~/.rivr-sim180/`, outside the repository.

## Spikes (8 Nov 2026)

| Spike | Question | Result |
|---|---|---|
| S1 | Does a signed-in app work with the browser months ahead, on the simulation's clock? | Yes, with `census/clock.ts`. Auth issues tokens on real time, so without it the player app refreshed its token 318 times in an hour of browser time; with each session's `expires_at` moved onto the browser's clock, once. The token itself is untouched. |
| S2 | Do the real outbox consumers run in Node against the copy? | Yes. On the seeded copy they claimed 79 deliveries and recorded the owner's alert in `sim.message`. |
| S3 | Does the virtual clock reach every job? | Yes. 1,424 `now()`, 12 `clock_timestamp()` and 7 `current_date` calls rewritten, none left. One quiet night fires all 17 non-outbox jobs with no failures, in 0.6 s. Start and reset take 86 s. |

Sign-in in the browser: Auth sends one code a minute to a number ("Too many tries. Wait a minute."), so every browser that signs in uses its own seeded number.

## Status

Being built on `chore/sim-180d`. The design and the build plan are the owner's documents of 8 Nov 2026. This README gains the run instructions, the spike results and the harness mistakes as the build goes.
