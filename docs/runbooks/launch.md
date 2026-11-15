# Launch: hardening week and the day before

Launch is Sunday 15 Nov 2026 (`docs/engineering/stack.md`). Hardening week, Wed 11 to Sat 14 Nov, is drills and fixes only (tech plan "Release gates", T-G3). Each step names who does it and where it is recorded. Tick a step off in its issue or in the record it names.

| By | Step | Who | Where it is recorded |
|---|---|---|---|
| Wed 11 Nov | Backups set up for staging and production, and the nightly run green for both (`docs/runbooks/backups-and-restore.md`, setup steps 1 to 8) | Owner | Actions → nightly-backup |
| Fri 13 Nov | Restore drill on staging's and production's latest nightly backups (`backups-and-restore.md`, "On staging and production") | Owner | The drill log in `backups-and-restore.md` |
| Fri 13 Nov | The security review's checks on staging and production (`docs/security/2026-10-review.md`, "Checks only staging or the owner can make"). The owner's decisions are built (#497 to #504, and P8 in #492), or each one is deferred by the owner | Owner, then a builder | The review record |
| Sat 14 Nov | Release the day's `main` to production (`ci-and-release.md`, "Releasing") | Owner | The GitHub release |

## Log

| Date | Environment | Step | By | Result |
|---|---|---|---|---|
| 3 Nov 2026 | production | First release, `release-20261103-1` at c8715a5d (go-live moved up from 15 Nov) | Claude, with the owner's leave | Migrations, Edge Functions and the five web apps live on rivrpoker.com; the tablet APK not built (no signing key yet) |
| 3 Nov 2026 | production | Club venue, two super admins and the alert number (create-a-venue.md) | Claude | Done; legal name, address and GSTIN from the GST certificate |
| 3 Nov 2026 | production | `release-20261103-3` at f842a8a6 (`-2` stopped on staging's paused promotions) | Claude | The club's number on the website, Privacy without HubSpot, Cashfree's sandbox kept (decision 0421) |
| 3 Nov 2026 | staging and production | The security review's checks 1 to 5 | Claude | 1, 2 and 5 pass, 3 done, 4 sandbox by decision 0421 (`docs/security/2026-10-review.md`) |
