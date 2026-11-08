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

## Status

Being built on `chore/sim-180d`. The design and the build plan are the owner's documents of 8 Nov 2026. This README gains the run instructions, the spike results and the harness mistakes as the build goes.
