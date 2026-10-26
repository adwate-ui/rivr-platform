# 0201: The tournament clock lives on the server, as a function of time

Date: 2026-10-26 · Task: #119

The tournament keeps three facts: when its clock started, when it was paused (if it is), and `clock_shift`, the time the floor moved it by. Elapsed time is `(paused_at or now) - started_at - shift`. The stage, the level and the seconds left follow from the levels (`private.tournament_clock_at`, proved equal to `@rivr/domain` `clockAt` on `tournamentClock.json`).

- **Survives any device dropping.** A console, TV or phone reads the elapsed seconds at the server's now and counts down locally from that reading (`elapsedNow`). A reload reads it again, so it lands on the right level and second. Device clocks never matter.
- **No pg_cron.** Nothing has to happen when a level changes, so nothing is scheduled. The issue named pg_cron; it is not needed.
- **Controls** (`tournaments.manage`): start, pause, resume, and Next or Previous level, which move the clock to the start of the next or previous stage. A break is a stage and counts as the level before it. Moving while paused stays paused. The design prompt's "+20 min" is the floor's Next level.
- **Past the end** the clock stays on the last stage with no time left, for the floor to finish (#121).
- **Which tournament the TVs and Home show:** the venue's published tournament whose clock started within the last day and has not run past its last stage, the latest started if two run. A clock nobody finished is left behind. Members read a tournament at all only with `tournaments.register`.
- **Two clock components.** `TournamentClock` (console) and `TvTournamentClock` (TV) show the same facts at two scales: the console's carries the floor's controls and no payouts column, the TV's fills the stage with the payouts beside it. One component with a size would need both layouts inside it.
- **Live.** Each clock change broadcasts `tournament` on the TVs' topic. Home reads every half minute.
- **Removing** a tournament made by mistake is allowed while nothing refers to it (no entry, no League finish).
