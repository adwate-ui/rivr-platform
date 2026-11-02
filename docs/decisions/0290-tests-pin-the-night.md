# 0290: A test that is not about the 06:00 turn pins its night

Date: 2 Nov 2026. Issue #716.

- **The failure.** CI on main went red at 06:14 IST: the full run's 00:17 UTC slot runs near the club's 06:00 IST turn every day. The waitlist, TV and door tests make joins and visits minutes before `now()`, and since 20261101150000_night_ends_clean.sql (B5 of the Fix Tracker) the lists hold only `joined_at >= private.tonight_began(now())`, a run just after 06:00 put those on last night's side. Every file was run with the turn moved to 1, 5, 30, 90 and 150 minutes before the test; eight fail in the first half hour (029, 032, 034, 044, 074, 096, 188, 206). 024, 043 and 145 fail there too, at every offset, only because they feed fixed times into the moved function; no other file fails.
- **Why not move the data.** Joins can be stamped after the turn, but the door's "past the first two minutes" needs a visit three minutes old on the same night, which does not exist from 06:00 to 06:03.
- **The rule.** Such a test pins its night after `select no_plan();`: `private.tonight_began` keeps its own rule, with the turn moved to twelve hours before the test, through a `night_shift` temp table; the file's rollback undoes it. Copy the block from `029_waitlist.test.sql`.
- **What stays real.** The turn itself is tested where it is the subject, with the real function: 043 (before and after 06:00) and 220 (what a night leaves open).
- **A seed's age.** 029, 044 and 074 read the seed's waiting places, made minutes before the seed ran, so with a night twelve hours long they need a seed under about eleven hours old: `pnpm db:reset` before a local run on an older stack, as `pnpm verify` and CI do.
