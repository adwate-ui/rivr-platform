# Launch: hardening week and the day before

Launch is Sunday 15 Nov 2026 (`docs/engineering/stack.md`). Hardening week, Wed 11 to Sat 14 Nov, is drills and fixes only (tech plan "Release gates", T-G3). Each step names who does it and where it is recorded. Tick a step off in its issue or in the record it names.

| By | Step | Who | Where it is recorded |
|---|---|---|---|
| Wed 11 Nov | Backups set up for staging and production, and the nightly run green for both (`docs/runbooks/backups-and-restore.md`, setup steps 1 to 8) | Owner | Actions → nightly-backup |
| Fri 13 Nov | Restore drill on staging's and production's latest nightly backups (`backups-and-restore.md`, "On staging and production") | Owner | The drill log in `backups-and-restore.md` |
| Fri 13 Nov | The security review's checks on staging and production (`docs/security/2026-10-review.md`, "Checks only staging or the owner can make"). The owner's decisions are built (#497 to #504, and P8 in #492), or each one is deferred by the owner | Owner, then a builder | The review record |
| Sat 14 Nov, after the last training session | **Reset the practice venue to its seed on production**, and on staging (below) | A super admin of the practice venue | The audit log (`practice.reset`), and a line in this file's log |
| Sat 14 Nov | Release the day's `main` to production (`ci-and-release.md`, "Releasing") | Owner | The GitHub release |

## Resetting the practice venue (Sat 14 Nov)

Staff train on the practice venue from 1 Nov. Before launch it goes back to its seed, so no training member, visit, cage shift or ledger entry carries into the live weeks (decisions 0117 and 0024).

1. **Who.** Sign in to the console as a super admin of the practice venue.
2. **Dry run.** Choose the practice venue and open Team → Practice reset. The dry run shows, per table, the rows now and the rows in the seed.
3. **Check the seed before resetting.** On production no seed file runs, so the seed is the practice venue as it stood when a migration last captured it (`private.capture_practice_seed`, decision 0117).
   - A release during training captures it with that day's training play.
   - If the seed's members, visits or ledger entries are training rows, the reset brings those back, not an empty floor.
   - Note what the seed holds. If it is not what the owner wants on the practice venue, stop and ask before resetting.
4. **Reset.** Type the venue's name exactly and press Reset to seed. One transaction then:
   - deletes the practice venue's play and reloads the seed;
   - checks the ledger balances;
   - writes the audit log.
   It is allowed once in five minutes. A kill-switch control naming a member the reset would remove stops it until the control is released.
5. **Check.** The dry run now says every table matches the seed. In the SQL editor, `select occurred_at from audit_log where action = 'practice.reset' order by occurred_at desc limit 1` shows the reset.
6. **Record** below: the date, the environment, who reset it and the seed's row counts for members, visits and ledger entries.

Nothing here touches the club's own venue. The reset refuses any venue that is not the practice venue (`RVPRA`).

## Log

| Date | Environment | Step | By | Result |
|---|---|---|---|---|
