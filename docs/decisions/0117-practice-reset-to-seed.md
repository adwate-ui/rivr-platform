# 0117: Reset to seed on the practice venue

Date: 2026-10-21 · Task: #104 (the owner's decision of 21 Oct: the practice reset now; purging a live venue, with its automatic export, is #432)

**What resets.** A practice venue's play: members, visits, seats, hands, the cage, the ledger, promotions, tournaments, incidents and messages. That is every venue table except a keep list (`private.practice_reset_keeps()`). Kept are:
- the venue's setup: staff, devices, configuration, settings, tiers, chips, tables, invoice series, contacts, drills, the website;
- its staff records: SOPs and acknowledgements, quizzes and every certification attempt;
- its kill-switch controls, so a revoke is never undone;
- the audit log.

`092_practice_reset` lists the tables that reset, so a new venue table needs a decision: reset or kept.

**The seed.** `private.practice_seed` holds a copy of each practice venue's play, taken by `capture_practice_seed`. The last seed file takes it locally and on staging. Where no seed runs, the migration takes the venue as it stands then. A later migration that adds per-venue rows, or a column without a default, to a table that resets must capture again (`.claude/rules/database.md`). The reload uses the seed's own columns, so a column added with a default takes it.

**How.** One transaction, for a super admin of the practice venue who types its name, at most once in five minutes. It uses purge's own setting, `rivr.purge`, for this venue and this transaction only (`private.purging`). With it:
- the append-only and guarded tables give up the venue's rows, as the ledger always allowed purge to;
- the reload replays nothing: no member accounts opened twice, no promotions run, no messages queued, no shift or call time recomputed.

The reset:
1. deletes the venue's play in one statement and reloads the seed in another, with foreign keys checked at the end of each, so tables that refer to each other (a cage shift and its chip count) need no order;
2. checks that every ledger transaction balances and every table matches its seed;
3. writes the audit log through `private.audit`.

There is no DDL and no lock on the club's tables. Sequences are left alone: the seed's rows keep their ids, and turning a shared sequence back would hand the club's ids out twice.

A kill-switch control that names a member the reset removes stops it, until the control is released.
